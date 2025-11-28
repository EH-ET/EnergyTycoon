import math
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
    "demand": {"field": "demand_bonus", "base_cost": 120, "price_growth": 1.2},
}

MARKET_STATE = {
    "sold_energy": 0,
    "base_cost": 1.0,  # 1 돈을 얻기 위해 필요한 에너지 기본값
}

# 누적 교환량 E에 따라 증가 단계 k = floor(log_3(E)), 증가율은 2k%
def _cost_growth_from_sales(sold: int) -> float:
    if sold <= 0:
        return 1.0
    k = math.floor(math.log(sold, 3))
    return 1.0 + (k * 0.05)


def current_market_rate(user: Optional[User] = None) -> float:
    base_cost = MARKET_STATE["base_cost"]
    sold = MARKET_STATE["sold_energy"]
    growth = _cost_growth_from_sales(sold)
    # 수요(시장) 보너스가 있을수록 필요한 에너지 감소
    bonus = 1.0
    if user:
        bonus -= (getattr(user, "demand_bonus", 0) or 0) * 0.05
    bonus = max(0.5, bonus)  # 보너스로 최소 절반까지 감소

    energy_per_money = base_cost * growth * bonus
    # 환율은 1 에너지당 돈이므로 역수
    rate = 1.0 / energy_per_money if energy_per_money > 0 else 0.0
    return max(0.0001, rate)


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
