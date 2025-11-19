from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..game_logic import current_market_rate, MARKET_STATE
from ..schemas import ExchangeIn
from ..models import User

router = APIRouter()


def _ensure_same_user(user: User, target_user_id: str):
    if user.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="User mismatch")


@router.post("/change/energy2money")
async def energy2money(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if payload.user_id:
        _ensure_same_user(user, payload.user_id)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    if user.energy < payload.amount:
        raise HTTPException(status_code=400, detail="Not enough energy")
    rate = current_market_rate(user)
    gained = int(payload.amount * rate)
    user.energy -= payload.amount
    user.money += gained
    MARKET_STATE["sold_energy"] += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money, "rate": rate}


@router.post("/change/money2energy")
async def money2energy(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if payload.user_id:
        _ensure_same_user(user, payload.user_id)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    if user.money < payload.amount:
        raise HTTPException(status_code=400, detail="Not enough money")
    rate = current_market_rate(user)
    user.money -= payload.amount
    user.energy += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money, "rate": rate}
