import math
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..models import Generator, GeneratorType, MapProgress, User
from ..bigvalue import (
    get_user_money_value,
    set_user_money_value,
    get_user_energy_value,
    set_user_energy_value,
    compare_plain,
    subtract_plain,
    from_payload,
    to_plain,
    from_plain,
    to_payload,
    BigValue,
    compare,
    subtract_values,
    divide_by_2,
    multiply_plain,
    multiply_by_float,
    add_values,
    add_plain,
)
from ..init_db import get_build_time_by_name
from ..schemas import ProgressAutoSaveIn, ProgressSaveIn, UserOut, GeneratorStateUpdate, GeneratorUpgradeRequest
import os

router = APIRouter()

MAX_GENERATOR_BASE = 10
MAX_GENERATOR_STEP = 1
DEMOLISH_COST_RATE = 0.5

GENERATOR_UPGRADE_CONFIG = {
    "production": {"field": "production_upgrade", "base_cost_multiplier": 1, "price_growth": 1.25},
    "heat_reduction": {"field": "heat_reduction_upgrade", "base_cost_multiplier": 0.8, "price_growth": 1.2},
    "tolerance": {"field": "tolerance_upgrade", "base_cost_multiplier": 0.9, "price_growth": 1.2},
}


def _ensure_same_user(user: User, target_user_id: Optional[str]):
    if target_user_id and user.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="User mismatch")


def _max_generators_allowed(user: User) -> int:
    bonus = getattr(user, "max_generators_bonus", 0) or 0
    return MAX_GENERATOR_BASE + bonus * MAX_GENERATOR_STEP


def _demolish_cost(generator_type: GeneratorType) -> BigValue:
    """Calculate demolish cost as 50% of generator cost."""
    cost_val = BigValue(generator_type.cost_data, generator_type.cost_high)
    # Calculate 50% by dividing by 2 (O(1) using BigValue)
    return divide_by_2(cost_val)


def _build_duration(generator_type: Optional[GeneratorType] = None, level: Optional[int] = None, user: Optional[User] = None) -> int:
    base_duration = 2  # Default: 2 seconds if no build time in data
    if generator_type and getattr(generator_type, "name", None):
        seconds = get_build_time_by_name(generator_type.name)
        if seconds:
            base_duration = max(1, int(seconds))
    
    # Apply build speed reduction from special upgrades
    if user:
        build_speed_reduction = getattr(user, "build_speed_reduction", 0) or 0
        # 10% reduction per level, max 90% reduction (level 9)
        reduction_rate = min(build_speed_reduction * 0.1, 0.9)
        base_duration = int(base_duration * (1 - reduction_rate))
    
    return max(1, base_duration)  # Minimum 1 second


def _maybe_complete_build(generator: Generator, now: Optional[int] = None) -> bool:
    if not generator.isdeveloping:
        return False
    now = now or int(time.time())
    if generator.build_complete_ts and generator.build_complete_ts <= now:
        generator.isdeveloping = False
        generator.build_complete_ts = None
        generator.running = True
        return True
    return False


def _serialize_generator(
    g: Generator,
    type_name: Optional[str] = None,
    cost_data: Optional[int] = None,
    cost_high: Optional[int] = None,
    mp: Optional[MapProgress] = None,
):
    """Serialize generator with BigValue cost."""
    # Get cost_data and cost_high from generator_type if not provided
    if cost_data is None:
        cost_data = getattr(getattr(g, "generator_type", None), "cost_data", 0)
    if cost_high is None:
        cost_high = getattr(getattr(g, "generator_type", None), "cost_high", 0)
    
    return {
        "generator_id": g.generator_id,
        "generator_type_id": g.generator_type_id,
        "type": type_name,
        "cost_data": cost_data,
        "cost_high": cost_high,
        "x_position": g.x_position,
        "world_position": g.world_position,
        "level": g.level,
        "isdeveloping": g.isdeveloping,
        "build_complete_ts": g.build_complete_ts,
        "heat": g.heat,
        "running": getattr(g, "running", True),
        "upgrades": {
            "production": getattr(mp, "production_upgrade", 0) if mp else 0,
            "heat_reduction": getattr(mp, "heat_reduction_upgrade", 0) if mp else 0,
            "tolerance": getattr(mp, "tolerance_upgrade", 0) if mp else 0,
        },
    }


@router.get("/progress")
async def load_progress(user_id: Optional[str] = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _ensure_same_user(user, user_id)
    gens = (
        db.query(Generator, MapProgress)
        .join(MapProgress, MapProgress.generator_id == Generator.generator_id)
        .filter(MapProgress.user_id == user.user_id)
        .all()
    )
    now = int(time.time())
    updated = False
    for g, mp in gens:
        if _maybe_complete_build(g, now):
            updated = True
    if updated:
        db.commit()
    out = []
    for g, mp in gens:
        type_name = getattr(g.generator_type, "name", None)
        cost_data = getattr(g.generator_type, "cost_data", 0)
        cost_high = getattr(g.generator_type, "cost_high", 0)
        out.append(_serialize_generator(g, type_name, cost_data, cost_high, mp))
    return {"user_id": user.user_id, "generators": out, "user": UserOut.model_validate(user)}


@router.post("/progress")
async def save_progress(payload: ProgressSaveIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _ensure_same_user(user, payload.user_id)
    
    gt = db.query(GeneratorType).filter_by(generator_type_id=payload.generator_type_id).first()
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    
    # Use FOR UPDATE to lock the user row and prevent race conditions
    user = db.query(User).filter_by(user_id=user.user_id).with_for_update().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_count = db.query(MapProgress).filter_by(user_id=user.user_id).count()
    if current_count >= _max_generators_allowed(user):
        raise HTTPException(status_code=400, detail="Generator limit reached")
    
    existing = (
        db.query(Generator)
        .join(MapProgress, MapProgress.generator_id == Generator.generator_id)
        .filter(
            MapProgress.user_id == user.user_id,
            Generator.world_position == payload.world_position,
            Generator.x_position == payload.x_position,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Generator already exists in this position")
    
    money_value = get_user_money_value(user)
    
    # Use BigValue cost from cost_data and cost_high for accurate deduction
    cost_val = BigValue(gt.cost_data, gt.cost_high)
    
    if compare(money_value, cost_val) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")
    
    g = Generator(
        generator_type_id=gt.generator_type_id,
        owner_id=user.user_id,
        x_position=payload.x_position,
        world_position=payload.world_position,
        isdeveloping=False,
        heat=0,
        running=True,
    )
    db.add(g)
    set_user_money_value(user, subtract_values(money_value, cost_val))
    build_duration = _build_duration(gt, g.level, user)
    g.isdeveloping = True
    g.build_complete_ts = int(time.time() + build_duration)
    db.commit()
    db.refresh(g)
    mp = MapProgress(user_id=user.user_id, generator_id=g.generator_id)
    db.add(mp)
    db.commit()
    db.refresh(user)
    return {
        "ok": True,
        "generator": _serialize_generator(g, gt.name, gt.cost_data, gt.cost_high, mp),
        "user": UserOut.model_validate(user),
    }


@router.delete("/progress/{generator_id}")
async def remove_generator(generator_id: str, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    gen = (
        db.query(Generator)
        .filter(Generator.generator_id == generator_id, Generator.owner_id == user.user_id)
        .first()
    )
    if not gen:
        raise HTTPException(status_code=404, detail="Generator not found")
    gt = db.query(GeneratorType).filter_by(generator_type_id=gen.generator_type_id).first()
    mp = db.query(MapProgress).filter_by(generator_id=generator_id, user_id=user.user_id).first()
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    cost_val = _demolish_cost(gt)
    money_value = get_user_money_value(user)
    if compare(money_value, cost_val) < 0:
        raise HTTPException(status_code=400, detail="Not enough money to demolish")
    mp = db.query(MapProgress).filter_by(user_id=user.user_id, generator_id=generator_id).first()
    if mp:
        db.delete(mp)
    db.delete(gen)
    set_user_money_value(user, subtract_values(money_value, cost_val))
    db.commit()
    db.refresh(user)
    # Return cost as BigValue components
    cost_payload = to_payload(cost_val)
    return {
        "user": UserOut.model_validate(user), 
        "demolished": {
            "generator_id": generator_id, 
            "cost_data": cost_payload["data"],
            "cost_high": cost_payload["high"]
        }
    }


@router.post("/progress/{generator_id}/state")
async def update_generator_state(generator_id: str, payload: GeneratorStateUpdate, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    gen = (
        db.query(Generator)
        .filter(Generator.generator_id == generator_id, Generator.owner_id == user.user_id)
        .first()
    )
    if not gen:
        raise HTTPException(status_code=404, detail="Generator not found")
    mp = db.query(MapProgress).filter_by(generator_id=generator_id, user_id=user.user_id).first()
    changed = False
    
    if payload.heat is not None:
        new_heat = max(0, int(payload.heat))
        current_heat = gen.heat or 0
        
        # Prevent suspicious heat resets (only allow gradual decreases)
        # Heat can only decrease by a reasonable amount per update (max 50 points)
        if new_heat < current_heat:
            max_heat_decrease = 50
            if current_heat - new_heat > max_heat_decrease:
                raise HTTPException(status_code=400, detail="Heat decrease too large")
        
        gen.heat = new_heat
        changed = True
    
    if payload.running is not None:
        gen.running = bool(payload.running)
        changed = True
    
    if payload.explode:
        gen.isdeveloping = True
        gen.running = False
        gen.heat = 0
        gen.build_complete_ts = int(time.time() + _build_duration(getattr(gen, "generator_type", None), gen.level, user))
        changed = True
    
    if not changed:
        raise HTTPException(status_code=400, detail="No changes provided")
    
    db.commit()
    db.refresh(gen)
    return {
        "user": UserOut.model_validate(user),
        "generator": _serialize_generator(
            gen,
            getattr(gen.generator_type, "name", None),
            getattr(gen.generator_type, "cost_data", 0),
            getattr(gen.generator_type, "cost_high", 0),
            mp,
        ),
    }


def _gen_upgrade_meta(key: str):
    meta = GENERATOR_UPGRADE_CONFIG.get(key)
    if not meta:
        raise HTTPException(status_code=404, detail="Unknown upgrade")
    return meta


def _calc_generator_upgrade_cost(gt: GeneratorType, mp: MapProgress, key: str, amount: int) -> BigValue:
    """Calculate upgrade cost using BigValue operations (O(1) per level, no 10^high computation)"""
    meta = _gen_upgrade_meta(key)
    # Use BigValue cost from cost_data and cost_high
    cost_val = BigValue(gt.cost_data, gt.cost_high)
    current_level = getattr(mp, meta["field"], 0) or 0

    # Calculate total cost by summing each level's cost using BigValue
    total_cost = BigValue(0, 0)
    for i in range(amount):
        level = current_level + i + 1
        # Calculate: base_cost * base_cost_multiplier * (price_growth ^ level)
        level_multiplier = meta["base_cost_multiplier"] * (meta["price_growth"] ** level)
        level_cost = multiply_by_float(cost_val, level_multiplier)
        total_cost = add_values(total_cost, level_cost)

    return total_cost


@router.post("/progress/{generator_id}/upgrade")
async def upgrade_generator(generator_id: str, payload: GeneratorUpgradeRequest, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    gen = (
        db.query(Generator)
        .filter(Generator.generator_id == generator_id, Generator.owner_id == user.user_id)
        .first()
    )
    if not gen:
        raise HTTPException(status_code=404, detail="Generator not found")
    gt = db.query(GeneratorType).filter_by(generator_type_id=gen.generator_type_id).first()
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    mp = db.query(MapProgress).filter_by(generator_id=generator_id, user_id=user.user_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Progress not found")
    amount = max(1, payload.amount or 1)
    cost_val = _calc_generator_upgrade_cost(gt, mp, payload.upgrade, amount)
    money_value = get_user_money_value(user)
    if compare(money_value, cost_val) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")
    meta = _gen_upgrade_meta(payload.upgrade)
    new_level = getattr(mp, meta["field"], 0) + amount
    setattr(mp, meta["field"], new_level)
    set_user_money_value(user, subtract_values(money_value, cost_val))
    db.commit()
    db.refresh(user)
    db.refresh(mp)
    db.refresh(gen)
    cost_payload = to_payload(cost_val)
    return {
        "user": UserOut.model_validate(user),
        "generator": _serialize_generator(
            gen,
            getattr(gt, "name", None),
            getattr(gt, "cost_data", 0),
            getattr(gt, "cost_high", 0),
            mp,
        ),
        "cost_data": cost_payload["data"],
        "cost_high": cost_payload["high"],
    }


def _calculate_total_energy_production(user: User, db: Session) -> BigValue:
    """Calculate total energy production per second from all user's generators using BigValue."""
    try:
        from ..init_db import DEFAULT_GENERATOR_TYPES, DEFAULT_GENERATOR_NAME_TO_INDEX

        # Get all running generators for this user
        generators = (
            db.query(Generator, MapProgress)
            .join(MapProgress, MapProgress.generator_id == Generator.generator_id)
            .filter(MapProgress.user_id == user.user_id, Generator.running == True, Generator.isdeveloping == False)
            .all()
        )

        total_production = BigValue(0, 0)
        production_bonus_multiplier = 1.0 + (getattr(user, "production_bonus", 0) or 0) * 0.1

        for gen, mp in generators:
            gt = gen.generator_type
            if not gt or not gt.name:
                continue

            # Find generator type info from defaults
            gen_index = DEFAULT_GENERATOR_NAME_TO_INDEX.get(gt.name)
            if gen_index is None:
                continue

            gen_data = DEFAULT_GENERATOR_TYPES[gen_index]
            # Use BigValue for base production (includes both data and high)
            base_production_data = gen_data.get("생산량(에너지수)", 0)
            base_production_high = gen_data.get("생산량(에너지높이)", 0)
            base_production = BigValue(base_production_data, base_production_high)

            # Apply production upgrades
            production_upgrade_level = getattr(mp, "production_upgrade", 0) or 0
            upgrade_multiplier = 1.0 + production_upgrade_level * 0.1

            # Calculate generator production using BigValue
            gen_production = multiply_by_float(base_production, production_bonus_multiplier * upgrade_multiplier)
            total_production = add_values(total_production, gen_production)

        # Apply rebirth multiplier: 2^n (MUST match frontend logic)
        rebirth_count = getattr(user, "rebirth_count", 0) or 0
        if rebirth_count > 0:
            rebirth_multiplier = 2 ** rebirth_count
            total_production = multiply_by_float(total_production, rebirth_multiplier)

        # Apply energy multiplier from special upgrades (2^level)
        energy_multiplier_level = getattr(user, "energy_multiplier", 0) or 0
        if energy_multiplier_level > 0:
            energy_multiplier = 2 ** energy_multiplier_level
            total_production = multiply_by_float(total_production, energy_multiplier)

        return total_production
    except Exception as e:
        # If calculation fails, return zero BigValue to avoid blocking autosave
        import logging
        logging.warning(f"Failed to calculate energy production: {e}")
        return BigValue(0, 0)


@router.post("/progress/autosave")
async def autosave_progress(payload: ProgressAutoSaveIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if payload is None:
        raise HTTPException(status_code=400, detail="No payload provided")
    
    # Import here to avoid circular dependency
    from ..game_logic import current_market_rate
    
    updated = False
    
    # Energy validation (using BigValue, no to_plain())
    energy_value = from_payload(payload.energy_data, payload.energy_high)
    if energy_value is not None:
        # Check for suspicious increases based on production rate * 1,000,000 seconds (allow idle play)
        current_energy_bv = get_user_energy_value(user)
        total_production_per_sec_bv = _calculate_total_energy_production(user, db)

        # Allow a maximum increase of production_rate * 1,000,000 seconds, or at least 1M
        # Use BigValue operations for accurate calculation
        max_reasonable_increase_bv = multiply_by_float(total_production_per_sec_bv, 1_000_000)
        min_increase_bv = from_plain(1_000_000)

        # Take the larger of the two
        if compare(max_reasonable_increase_bv, min_increase_bv) < 0:
            max_reasonable_increase_bv = min_increase_bv

        max_allowed_energy = add_values(current_energy_bv, max_reasonable_increase_bv)

        if compare(energy_value, max_allowed_energy) > 0:
            raise HTTPException(status_code=400, detail="Energy increase is suspiciously large")

        set_user_energy_value(user, energy_value)
        updated = True
    
    # Money validation (using BigValue, no to_plain())
    money_value = from_payload(payload.money_data, payload.money_high)
    if money_value is not None:
        # Check for suspicious increases based on energy * exchange_rate * 1,000,000 (allow idle play)
        current_money_bv = get_user_money_value(user)
        current_energy_bv = get_user_energy_value(user)

        try:
            exchange_rate = current_market_rate(user)
            # Maximum reasonable money increase: current_energy * exchange_rate * 1,000,000
            # Calculate using BigValue operations
            energy_times_rate = multiply_by_float(current_energy_bv, exchange_rate * 1_000_000)
            # At least 1M
            min_increase_bv = from_plain(1_000_000)
            # Take the larger of the two
            max_reasonable_increase_bv = energy_times_rate if compare(energy_times_rate, min_increase_bv) > 0 else min_increase_bv
            max_allowed_money = add_values(current_money_bv, max_reasonable_increase_bv)
            if compare(money_value, max_allowed_money) > 0:
                raise HTTPException(status_code=400, detail="Money increase is suspiciously large")
        except Exception as e:
            # Log error but don't block autosave
            import logging
            logging.warning(f"Money validation failed: {e}")
            # Skip validation on error

        set_user_money_value(user, money_value)
        updated = True
    
    if payload.play_time_ms is not None:
        user.play_time_ms = max(0, int(payload.play_time_ms))
        updated = True

    if payload.supercoin is not None:
        user.supercoin = max(0, int(payload.supercoin))
        updated = True

    # Update generators (heat, running)
    if payload.generators:
        gen_updates = {g.generator_id: g for g in payload.generators if g.generator_id}
        if gen_updates:
            # Fetch relevant generators owned by user
            gens = (
                db.query(Generator)
                .filter(
                    Generator.generator_id.in_(gen_updates.keys()),
                    Generator.owner_id == user.user_id
                )
                .all()
            )
            for g in gens:
                update_data = gen_updates.get(g.generator_id)
                if update_data:
                    if update_data.heat is not None:
                        g.heat = max(0, int(update_data.heat))
                        updated = True
                    if update_data.running is not None:
                        g.running = bool(update_data.running)
                        updated = True
    
    if not updated:
        raise HTTPException(status_code=400, detail="No fields provided to autosave")
    
    db.commit()
    db.refresh(user)
    return {"user": UserOut.model_validate(user)}


@router.post("/progress/{generator_id}/build/skip")
async def skip_build(generator_id: str, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    gen = (
        db.query(Generator)
        .filter(Generator.generator_id == generator_id, Generator.owner_id == user.user_id)
        .first()
    )
    if not gen:
        raise HTTPException(status_code=404, detail="Generator not found")
    gt = db.query(GeneratorType).filter_by(generator_type_id=gen.generator_type_id).first()
    mp = db.query(MapProgress).filter_by(generator_id=generator_id, user_id=user.user_id).first()
    type_name = getattr(gt, "name", None)
    cost_data = getattr(gt, "cost_data", 0)
    cost_high = getattr(gt, "cost_high", 0)
    now = int(time.time())
    if _maybe_complete_build(gen, now):
        db.commit()
        db.refresh(gen)
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, cost_data, cost_high, mp),
        }
    if not gen.isdeveloping or not gen.build_complete_ts:
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, cost_data, cost_high, mp),
        }
    remaining = max(0, gen.build_complete_ts - now)
    if remaining <= 0:
        gen.isdeveloping = False
        gen.build_complete_ts = None
        gen.running = True
        db.commit()
        db.refresh(gen)
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, cost_data, cost_high, mp),
        }
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    
    # Calculate proportional cost using BigValue (no to_plain())
    try:
        total_duration = max(1, _build_duration(gt, gen.level, user))
        full_cost_val = BigValue(gt.cost_data, gt.cost_high)
        # Proportional cost based on remaining time: (remaining / total_duration) * full_cost
        proportion = remaining / total_duration
        cost_val = multiply_by_float(full_cost_val, proportion)
        # Ensure at least cost of 1
        if cost_val.data == 0:
            cost_val = from_plain(1)
    except Exception as e:
        import logging
        logging.error(f"Skip build cost calculation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Cost calculation failed: {str(e)}")
    
    money_value = get_user_money_value(user)
    if compare(money_value, cost_val) < 0:
        raise HTTPException(status_code=400, detail="Not enough money to skip build")
    set_user_money_value(user, subtract_values(money_value, cost_val))
    gen.isdeveloping = False
    gen.build_complete_ts = None
    gen.running = True
    db.commit()
    db.refresh(gen)
    db.refresh(user)
    
    cost_payload = to_payload(cost_val)
    return {
        "user": UserOut.model_validate(user),
        "generator": _serialize_generator(gen, type_name, cost_data, cost_high, mp),
        "skip_cost_data": cost_payload["data"],
        "skip_cost_high": cost_payload["high"],
        "remaining_seconds": remaining,
    }

