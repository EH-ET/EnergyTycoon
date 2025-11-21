from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import User
from .bigvalue import (
    get_user_money_value,
    set_user_money_value,
    compare_plain,
    subtract_plain,
)

UPGRADE_CONFIG = {
    "production": {"field": "production_bonus", "base_cost": 100, "price_growth": 1.25},
    "heat_reduction": {"field": "heat_reduction", "base_cost": 100, "price_growth": 1.15},
    "tolerance": {"field": "tolerance_bonus", "base_cost": 100, "price_growth": 1.2},
    "max_generators": {"field": "max_generators_bonus", "base_cost": 150, "price_growth": 1.3},
    "supply": {"field": "supply_bonus", "base_cost": 120, "price_growth": 1.2},
}

MARKET_STATE = {
    "sold_energy": 0,
    "base_rate": 1.0,
}


def current_market_rate(user: Optional[User] = None) -> float:
    base = MARKET_STATE["base_rate"]
    sold = MARKET_STATE["sold_energy"]
    drop = min(0.7, sold / 500)
    bonus = 1.0
    if user:
        bonus += (getattr(user, "supply_bonus", 0) or 0) * 0.05
    rate = base * (1 - drop) * bonus
    return max(0.1, rate)


def get_upgrade_meta(key: str):
    meta = UPGRADE_CONFIG.get(key)
    if not meta:
        raise HTTPException(status_code=404, detail="업그레이드 구성이 없습니다.")
    return meta


def calculate_upgrade_cost(user: User, key: str, amount: int = 1) -> int:
    meta = get_upgrade_meta(key)
    current_level = getattr(user, meta["field"], 0)
    total_cost = 0
    for i in range(amount):
        level = current_level + i + 1
        total_cost += int(meta["base_cost"] * (meta["price_growth"] ** level))
    return total_cost


def apply_upgrade(user: User, db: Session, key: str, amount: int) -> User:
    meta = get_upgrade_meta(key)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Increase amount must be at least 1")
    cost = calculate_upgrade_cost(user, key, amount)
    money_value = get_user_money_value(user)
    if compare_plain(money_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")
    set_user_money_value(user, subtract_plain(money_value, cost))
    setattr(user, meta["field"], getattr(user, meta["field"], 0) + amount)
    db.commit()
    db.refresh(user)
    return user
