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
)
from ..schemas import ProgressAutoSaveIn, ProgressSaveIn, UserOut
from ..bigvalue import (
    get_user_money_value,
    set_user_money_value,
    get_user_energy_value,
    set_user_energy_value,
    compare_plain,
    subtract_plain,
    from_payload,
    to_plain,
)
import os

router = APIRouter()

MAX_GENERATOR_BASE = 10
MAX_GENERATOR_STEP = 5
DEMOLISH_COST_RATE = 0.5
MAX_ENERGY_VALUE = int(os.getenv("MAX_ENERGY_VALUE", 1_000_000_000_000))
MAX_MONEY_VALUE = int(os.getenv("MAX_MONEY_VALUE", 1_000_000_000_000))


def _ensure_same_user(user: User, target_user_id: Optional[str]):
    if target_user_id and user.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="User mismatch")


def _max_generators_allowed(user: User) -> int:
    bonus = getattr(user, "max_generators_bonus", 0) or 0
    return MAX_GENERATOR_BASE + bonus * MAX_GENERATOR_STEP


def _demolish_cost(generator_type: GeneratorType) -> int:
    return max(1, int(generator_type.cost * DEMOLISH_COST_RATE))


def _build_duration(level: int) -> int:
    lvl = max(1, level or 1)
    return max(1, int(2 ** lvl))


def _maybe_complete_build(generator: Generator, now: Optional[int] = None) -> bool:
    if not generator.isdeveloping:
        return False
    now = now or int(time.time())
    if generator.build_complete_ts and generator.build_complete_ts <= now:
        generator.isdeveloping = False
        generator.build_complete_ts = None
        return True
    return False


def _serialize_generator(g: Generator, type_name: Optional[str] = None, cost: Optional[int] = None):
    return {
        "generator_id": g.generator_id,
        "generator_type_id": g.generator_type_id,
        "type": type_name,
        "cost": cost if cost is not None else getattr(getattr(g, "generator_type", None), "cost", None),
        "x_position": g.x_position,
        "world_position": g.world_position,
        "level": g.level,
        "isdeveloping": g.isdeveloping,
        "build_complete_ts": g.build_complete_ts,
        "heat": g.heat,
    }


@router.get("/progress")
async def load_progress(user_id: Optional[str] = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _ensure_same_user(user, user_id)
    gens = (
        db.query(Generator)
        .join(MapProgress, MapProgress.generator_id == Generator.generator_id)
        .filter(MapProgress.user_id == user.user_id)
        .all()
    )
    now = int(time.time())
    updated = False
    for g in gens:
        if _maybe_complete_build(g, now):
            updated = True
    if updated:
        db.commit()
    out = []
    for g in gens:
        type_name = getattr(g.generator_type, "name", None)
        cost = getattr(g.generator_type, "cost", None)
        out.append(_serialize_generator(g, type_name, cost))
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
    if compare_plain(money_value, gt.cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")
    g = Generator(
        generator_type_id=gt.generator_type_id,
        owner_id=user.user_id,
        x_position=payload.x_position,
        world_position=payload.world_position,
        isdeveloping=False,
        heat=0,
    )
    db.add(g)
    set_user_money_value(user, subtract_plain(money_value, gt.cost))
    build_duration = _build_duration(g.level)
    g.isdeveloping = True
    g.build_complete_ts = int(time.time() + build_duration)
    db.commit()
    db.refresh(g)
    db.add(MapProgress(user_id=user.user_id, generator_id=g.generator_id))
    db.commit()
    return {
        "ok": True,
        "generator": _serialize_generator(g, gt.name, gt.cost),
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
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    cost = _demolish_cost(gt)
    money_value = get_user_money_value(user)
    if compare_plain(money_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money to demolish")
    mp = db.query(MapProgress).filter_by(user_id=user.user_id, generator_id=generator_id).first()
    if mp:
        db.delete(mp)
    db.delete(gen)
    set_user_money_value(user, subtract_plain(money_value, cost))
    db.commit()
    db.refresh(user)
    return {"user": UserOut.model_validate(user), "demolished": {"generator_id": generator_id, "cost": cost}}


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
    type_name = getattr(gt, "name", None)
    type_cost = getattr(gt, "cost", None)
    now = int(time.time())
    if _maybe_complete_build(gen, now):
        db.commit()
        db.refresh(gen)
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, type_cost),
        }
    if not gen.isdeveloping or not gen.build_complete_ts:
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, type_cost),
        }
    remaining = max(0, gen.build_complete_ts - now)
    if remaining <= 0:
        gen.isdeveloping = False
        gen.build_complete_ts = None
        db.commit()
        db.refresh(gen)
        return {
            "user": UserOut.model_validate(user),
            "generator": _serialize_generator(gen, type_name, type_cost),
        }
    if not gt:
        raise HTTPException(status_code=404, detail="Generator type not found")
    cost = max(1, math.ceil((remaining * (gt.cost or 1)) / 10))
    money_value = get_user_money_value(user)
    if compare_plain(money_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money to skip build")
    set_user_money_value(user, subtract_plain(money_value, cost))
    gen.isdeveloping = False
    gen.build_complete_ts = None
    db.commit()
    db.refresh(gen)
    return {
        "user": UserOut.model_validate(user),
        "generator": _serialize_generator(gen, type_name, type_cost),
        "skip_cost": cost,
        "remaining_seconds": remaining,
    }
