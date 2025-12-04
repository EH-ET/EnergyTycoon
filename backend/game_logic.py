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
    # 클라이언트(data.js)와 동일한 비용 곡선
    "production": {"field": "production_bonus", "base_cost": 10, "price_growth": 1.8},
    "heat_reduction": {"field": "heat_reduction", "base_cost": 50, "price_growth": 1.5},
    "tolerance": {"field": "tolerance_bonus", "base_cost": 60, "price_growth": 2.0},
    "max_generators": {"field": "max_generators_bonus", "base_cost": 300, "price_growth": 3.0},
    "demand": {"field": "demand_bonus", "base_cost": 15, "price_growth": 2.0},
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


def current_market_rate(user: Optional[User] = None, sold_override: Optional[int] = None) -> float:
    """
    현재 시장 환율 계산

    Args:
        user: 사용자 (보너스 적용용)
        sold_override: 판매량 오버라이드 (None이면 user.sold_energy 사용)

    Returns:
        1 에너지당 돈 환율
    """
    base_cost = 1.0  # 기본 비용
    
    # sold_override가 있으면 사용, 없으면 user.sold_energy 사용, 둘 다 없으면 0
    if sold_override is not None:
        sold = sold_override
    elif user and hasattr(user, 'sold_energy'):
        sold = getattr(user, 'sold_energy', 0) or 0
    else:
        sold = 0
    
    growth = _cost_growth_from_sales(sold)
    # 수요(시장) 보너스가 있을수록 필요한 에너지 감소
    bonus = 1.0
    if user:
        bonus -= (getattr(user, "demand_bonus", 0) or 0) * 0.05
    bonus = max(0.5, bonus)  # 보너스로 최소 절반까지 감소

    energy_per_money = base_cost * growth * bonus
    # 환율은 1 에너지당 돈이므로 역수
    rate = 1.0 / energy_per_money if energy_per_money > 0 else 0.0
    
    # Apply rebirth multiplier: 2^n
    if user:
        rebirth_count = getattr(user, "rebirth_count", 0) or 0
        if rebirth_count > 0:
            rebirth_multiplier = 2 ** rebirth_count
            rate *= rebirth_multiplier
    
    # Apply exchange rate multiplier from special upgrades (2^level)
    if user:
        exchange_mult_level = getattr(user, "exchange_rate_multiplier", 0) or 0
        if exchange_mult_level > 0:
            exchange_multiplier = 2 ** exchange_mult_level
            rate *= exchange_multiplier
    
    return max(0.0001, rate)


def calculate_progressive_exchange(user: Optional[User], amount: int) -> tuple[int, float]:
    """
    대량 거래 시 점진적으로 변하는 환율을 적용하여 실제 획득량 계산

    Args:
        user: 사용자 (보너스 적용용)
        amount: 교환할 에너지 양

    Returns:
        (총 획득 돈, 평균 환율)
    """
    if amount <= 0:
        return 0, 0.0

    current_sold = getattr(user, 'sold_energy', 0) or 0 if user else 0
    total_gained = 0

    # 성능 최적화: 100 단위로 묶어서 계산 (너무 작으면 정확도 저하, 너무 크면 성능 저하)
    chunk_size = min(100, max(1, amount // 1000))

    remaining = amount
    sold_so_far = current_sold

    while remaining > 0:
        chunk = min(chunk_size, remaining)
        # 이 청크의 중간 시점 환율 사용 (적분 근사)
        mid_sold = sold_so_far + chunk // 2
        rate = current_market_rate(user, sold_override=mid_sold)
        gained = chunk * rate
        total_gained += gained

        sold_so_far += chunk
        remaining -= chunk

    # 평균 환율 계산
    avg_rate = total_gained / amount if amount > 0 else 0.0

    return max(1, int(total_gained)), avg_rate


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
