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
)
from ..init_db import get_build_time_by_name
from ..schemas import ProgressAutoSaveIn, ProgressSaveIn, UserOut, GeneratorStateUpdate, GeneratorUpgradeRequest
import os

router = APIRouter()

MAX_GENERATOR_BASE = 10
MAX_GENERATOR_STEP = 1
DEMOLISH_COST_RATE = 0.5
MAX_ENERGY_VALUE = int(os.getenv("MAX_ENERGY_VALUE", 1_000_000_000_000))
MAX_MONEY_VALUE = int(os.getenv("MAX_MONEY_VALUE", 1_000_000_000_000))
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
    # Calculate 50% by dividing by 2
    plain = to_plain(cost_val)
    half_plain = max(1, plain // 2)
    return from_plain(half_plain)


def _build_duration(generator_type: Optional[GeneratorType] = None, level: Optional[int] = None) -> int:
    if generator_type and getattr(generator_type, "name", None):
        seconds = get_build_time_by_name(generator_type.name)
        if seconds:
            return max(1, int(seconds))
    # 기본값: 데이터에 설치시간이 없으면 2초로 고정
    return 2


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
    build_duration = _build_duration(gt, g.level)
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
        gen.heat = max(0, int(payload.heat))
        changed = True
    if payload.running is not None:
        gen.running = bool(payload.running)
        changed = True
    if payload.explode:
        gen.isdeveloping = True
        gen.running = False
        gen.heat = 0
        gen.build_complete_ts = int(time.time() + _build_duration(getattr(gen, "generator_type", None), gen.level))
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
    meta = _gen_upgrade_meta(key)
    # Use BigValue base cost from cost_data and cost_high
    base_val = BigValue(gt.cost_data, gt.cost_high)
    base_cost = to_plain(base_val)
    
    current_level = getattr(mp, meta["field"], 0) or 0
    total = 0
    for i in range(amount):
        level = current_level + i + 1
        total += int(base_cost * meta["base_cost_multiplier"] * (meta["price_growth"] ** level))
    return from_plain(max(1, total))


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


@router.post("/progress/autosave")
async def autosave_progress(payload: ProgressAutoSaveIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if payload is None:
        raise HTTPException(status_code=400, detail="No payload provided")
    updated = False
    energy_value = from_payload(payload.energy_data, payload.energy_high, payload.energy)
    if energy_value is not None:
        energy_plain = to_plain(energy_value)
        if energy_plain > MAX_ENERGY_VALUE:
            raise HTTPException(status_code=400, detail="Energy value too large")
        set_user_energy_value(user, energy_value)
        updated = True
    money_value = from_payload(payload.money_data, payload.money_high, payload.money)
    if money_value is not None:
        money_plain = to_plain(money_value)
        if money_plain > MAX_MONEY_VALUE:
            raise HTTPException(status_code=400, detail="Money value too large")
        set_user_money_value(user, money_value)
        updated = True
    if payload.play_time_ms is not None:
        user.play_time_ms = max(0, int(payload.play_time_ms))
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
    
    # Calculate proportional cost using BigValue
    total_duration = max(1, _build_duration(gt, gen.level))
    full_cost_val = BigValue(gt.cost_data, gt.cost_high)
    full_cost_plain = to_plain(full_cost_val)
    # Proportional cost based on remaining time
    proportional_plain = max(1, math.ceil((remaining / total_duration) * full_cost_plain))
    cost_val = from_plain(proportional_plain)
    
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

