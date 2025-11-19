from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..models import Generator, GeneratorType, MapProgress, User
from ..schemas import ProgressSaveIn, UserOut

router = APIRouter()

MAX_GENERATOR_BASE = 10
MAX_GENERATOR_STEP = 5
DEMOLISH_COST_RATE = 0.5


def _ensure_same_user(user: User, target_user_id: Optional[str]):
    if target_user_id and user.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="User mismatch")


def _max_generators_allowed(user: User) -> int:
    bonus = getattr(user, "max_generators_bonus", 0) or 0
    return MAX_GENERATOR_BASE + bonus * MAX_GENERATOR_STEP
def _demolish_cost(generator_type: GeneratorType) -> int:
    return max(1, int(generator_type.cost * DEMOLISH_COST_RATE))


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
    out = []
    for g in gens:
        out.append(
            {
                "generator_id": g.generator_id,
                "generator_type_id": g.generator_type_id,
                "level": g.level,
                "x_position": g.x_position,
                "world_position": g.world_position,
                "isdeveloping": g.isdeveloping,
                "heat": g.heat,
            }
        )
    return {"user_id": user.user_id, "generators": out, "user": UserOut.model_validate(user)}


@router.post("/progress")
async def save_progress(payload: ProgressSaveIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _ensure_same_user(user, payload.user_id)
    if payload.energy is not None:
        if payload.energy < 0:
            raise HTTPException(status_code=400, detail="Energy cannot be negative")
        user.energy = payload.energy
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
    if user.money < gt.cost:
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
    user.money -= gt.cost
    db.commit()
    db.refresh(g)
    db.add(MapProgress(user_id=user.user_id, generator_id=g.generator_id))
    db.commit()
    return {
        "ok": True,
        "generator": {
            "generator_id": g.generator_id,
            "generator_type_id": g.generator_type_id,
            "type": gt.name,
            "x_position": g.x_position,
            "world_position": g.world_position,
            "level": g.level,
            "isdeveloping": g.isdeveloping,
            "heat": g.heat,
        },
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
    if user.money < cost:
        raise HTTPException(status_code=400, detail="Not enough money to demolish")
    mp = db.query(MapProgress).filter_by(user_id=user.user_id, generator_id=generator_id).first()
    if mp:
        db.delete(mp)
    db.delete(gen)
    user.money -= cost
    db.commit()
    db.refresh(user)
    return {"user": UserOut.model_validate(user), "demolished": {"generator_id": generator_id, "cost": cost}}
