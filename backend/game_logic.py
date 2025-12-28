import math
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import User
from .bigvalue import (
    BigValue,
    get_user_money_value,
    set_user_money_value,
    get_user_sold_energy_value,
    compare_plain,
    subtract_plain,
    to_plain,
    from_plain,
    normalize,
    add_values,
    get_user_electronic_sparkle_value,
    set_user_electronic_sparkle_value,
    power_int,
    multiply_values,
    compare,
    subtract_values,
    get_user_proton_value,
    set_user_proton_value,
)

UPGRADE_CONFIG = {
    # 클라이언트(data.js)와 동일한 비용 곡선
    "production": {"field": "production_bonus", "base_cost": from_plain(10), "price_growth": 1.8},
    "heat_reduction": {"field": "heat_reduction", "base_cost": from_plain(50), "price_growth": 1.5},
    "tolerance": {"field": "tolerance_bonus", "base_cost": from_plain(60), "price_growth": 2.0},
    "max_generators": {"field": "max_generators_bonus", "base_cost": from_plain(300), "price_growth": 8.0},
    "demand": {"field": "demand_bonus", "base_cost": from_plain(15), "price_growth": 2.0},
}

REBIRTH_UPGRADE_CONFIG = {
    # cost = base_cost * price_growth^(current_level), paid with rebirth count
    "rebirth_chain": {"field": "rebirth_chain_upgrade", "base_cost": 1, "price_growth": 2.0},
    "upgrade_batch": {"field": "upgrade_batch_upgrade", "base_cost": 1, "price_growth": 2.0},
    "rebirth_start_money": {"field": "rebirth_start_money_upgrade", "base_cost": 3, "price_growth": 3.0},
}

SPARKLE_UPGRADE_CONFIG = {
    "sparkle_chance_upgrade": {"field": "sparkle_chance_upgrade", "base_cost": BigValue(10000, 0), "price_growth": 12, "max_level": 1000},
    "sparkle_amount_upgrade": {"field": "sparkle_amount_upgrade", "base_cost": BigValue(5000, 0), "price_growth": 8},
    "sparkle_energy_multiplier_upgrade": {"field": "sparkle_energy_multiplier_upgrade", "base_cost": BigValue(100000, 1), "price_growth": 20},
    "sparkle_rebirth_chain_upgrade": {"field": "sparkle_rebirth_chain_upgrade", "base_cost": BigValue(1000, 30), "price_growth": 20},
}

MONEY_UPGRADE_POLY_CONFIG = {
    "money_sparkle_bonus_upgrade": {"field": "money_sparkle_bonus_upgrade", "base_cost": BigValue(1000, 30), "price_growth": 20},
    "proton_gain_money_upgrade": {"field": "proton_gain_money_upgrade", "base_cost": from_plain(1_000_000), "price_growth": 2},
}

REBIRTH_UPGRADE_POLY_CONFIG = {
    "rebirth_sparkle_bonus_upgrade": {"field": "rebirth_sparkle_bonus_upgrade", "base_cost": 5, "price_growth": 5}, # cost is int
    "proton_gain_rebirth_upgrade": {"field": "proton_gain_rebirth_upgrade", "base_cost": 3, "price_growth": 2},
}

PROTON_UPGRADE_CONFIG = {
    # cost = base_cost * (multiplier_base ^ level)
    "proton_demand_increase": {
        "field": "proton_demand_increase_upgrade",
        "base_cost": from_plain(1_000_000),
        "multiplier_base": from_plain(1_000_000),
        "type": "exponential"
    },
    "proton_energy_gain": {
        "field": "proton_energy_gain_upgrade",
        "base_cost": from_plain(1_000_000),  # 1M proton
        "multiplier_base": from_plain(1_000_000),  # * 1M per level
        "type": "exponential"
    },
    "proton_sparkle_gain": {
        "field": "proton_sparkle_gain_upgrade",
        "base_cost": from_plain(1_000_000_000),
        "multiplier_base": from_plain(1_000_000_000),
        "type": "exponential"
    },
}

# 누적 교환량 E에 따라 증가 단계 k = floor(log_3(E)), 증가율은 2k%
# BigValue 지원을 위해 로그 계산 로직 내부로 통합



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
    from .bigvalue import get_user_sold_energy_value
    
    if sold_override is not None:
        # Override is int, convert to log3
        if sold_override <= 0:
            log_val = 0
        else:
            log_val = math.log(sold_override, 3)
    elif user:
        sold_bv = get_user_sold_energy_value(user)
        # log3(d * 10^h) = log3(d/1000) + h * log3(10) + log3(1000)?
        # from_plain(1) -> data=1000, high=0. Real value = 1.
        # Real = data / 1000 * 10^high
        real_data = max(1, sold_bv.data) / 1000.0
        LOG3_10 = 2.09590327429
        log_val = math.log(real_data, 3) + (sold_bv.high * LOG3_10)
        if log_val < 0: log_val = 0
    else:
        log_val = 0
    
    growth = 1.0 + (int(log_val) * 0.05)
    
    # 수요(시장) 보너스가 있을수록 필요한 에너지 감소 (나눗셈으로 변경하여 점진적 적용)
    bonus = 1.0
    if user:
        demand_val = getattr(user, "demand_bonus", 0) or 0
        bonus = 1.0 / (1.0 + demand_val * 0.05)

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
            
        # Apply Proton Demand Increase (1.5^level)
        proton_demand = getattr(user, "proton_demand_increase_upgrade", 0) or 0
        if proton_demand > 0:
            proton_multiplier = 1.5 ** proton_demand
            rate *= proton_multiplier
    
    return max(0.0001, rate)


def calculate_progressive_exchange(user: Optional[User], amount: int | BigValue) -> tuple[BigValue, float]:
    """
    BigValue 시스템을 지원하는 점진적 환율 계산
    
    Args:
        amount: 교환할 에너지 양 (int 또는 BigValue)
        
    Returns:
        (총 획득 돈 BigValue, 평균 환율)
    """
    # 0. Amount 정규화
    if isinstance(amount, int):
        amount_bv = from_plain(amount)
    else:
        amount_bv = normalize(amount)
        
    if amount_bv.data <= 0:
        return from_plain(0), 0.0

    # 1. 상수 계수 계산 (Numerator)
    # Rate = Numerator / Denominator
    # Numerator = BaseCost(1.0) * RebirthMult * ExchangeMult
    base_numerator = 1.0
    if user:
        rebirth_count = getattr(user, "rebirth_count", 0) or 0
        if rebirth_count > 0:
            base_numerator *= (2 ** rebirth_count)
        
        exchange_mult_level = getattr(user, "exchange_rate_multiplier", 0) or 0
        if exchange_mult_level > 0:
            base_numerator *= (2 ** exchange_mult_level)
            
        # Apply Proton Demand Increase (1.5^level)
        proton_demand = getattr(user, "proton_demand_increase_upgrade", 0) or 0
        if proton_demand > 0:
            base_numerator *= (1.5 ** proton_demand)

    # Market Bonus (Denominator term)
    market_bonus_factor = 1.0
    if user:
        demand_val = getattr(user, "demand_bonus", 0) or 0
        market_bonus_factor = 1.0 / (1.0 + demand_val * 0.05)
    
    # 2. 현재 상태 확인 (BigValue)
    from .bigvalue import get_user_sold_energy_value, add_values
    current_sold_bv = get_user_sold_energy_value(user)
    
    # 3. O(1) 수학적 근사 계산
    # 구간의 중간값(Midpoint)에서의 환율을 전체 평균 환율로 근사
    # Midpoint = CurrentSold + Amount / 2
    
    # Amount / 2 계산
    half_amount_bv = normalize(BigValue(amount_bv.data // 2, amount_bv.high))
    mid_bv = add_values(current_sold_bv, half_amount_bv)
    
    # Midpoint의 log3 값 계산
    # Real = data / 1000 * 10^high
    real_data = max(1, mid_bv.data) / 1000.0
    LOG3_10 = 2.09590327429
    log_mid = math.log(real_data, 3) + (mid_bv.high * LOG3_10)
    if log_mid < 0: log_mid = 0
    
    # Growth = 1 + 0.05 * floor(log_mid)
    # (연속성을 위해 floor 대신 그냥 log_mid를 쓸 수도 있으나, 게임 규칙상 단계별 증가라면 int 사용)
    # 여기서는 부드러운 증가를 위해 그대로 쓰거나, 기존 로직(단계별)을 유지하기 위해 int 사용
    # 기존: floor(log3(E))
    growth = 1.0 + (int(log_mid) * 0.05)
    
    denom = growth * market_bonus_factor
    avg_rate = max(0.0000001, base_numerator / denom)
    
    # Total Money = Amount * Rate
    # Result BigValue = (Amount.data * Rate, Amount.high)
    new_data = int(amount_bv.data * avg_rate)
    new_high = amount_bv.high
    
    result_bv = normalize(BigValue(new_data, new_high))
    
    return result_bv, avg_rate


def get_upgrade_meta(key: str):
    meta = UPGRADE_CONFIG.get(key)
    if not meta:
        raise HTTPException(status_code=404, detail="업그레이드 구성이 없습니다.")
    return meta


def get_rebirth_upgrade_meta(key: str):
    meta = REBIRTH_UPGRADE_CONFIG.get(key)
    if not meta:
        raise HTTPException(status_code=404, detail="환생 업그레이드 구성이 없습니다.")
    return meta


def get_upgrade_batch_limit(user: User) -> int:
    """Return maximum amount allowed in a single upgrade purchase."""
    return 1 + (getattr(user, "upgrade_batch_upgrade", 0) or 0)


def calculate_upgrade_cost(user: User, key: str, amount: int = 1) -> BigValue:
    return calculate_polynomial_cost(user, UPGRADE_CONFIG, key, amount)


def calculate_rebirth_upgrade_cost(user: User, key: str, amount: int = 1) -> int:
    return calculate_polynomial_cost_int(user, REBIRTH_UPGRADE_CONFIG, key, amount)


def apply_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    meta = get_upgrade_meta(key)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Increase amount must be at least 1")
    max_amount = get_upgrade_batch_limit(user)
    if amount > max_amount:
        raise HTTPException(status_code=400, detail=f"한 번에 {max_amount}회까지만 업그레이드할 수 있습니다.")
    cost = calculate_upgrade_cost(user, key, amount)
    money_value = get_user_money_value(user)
    if compare(money_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")
    set_user_money_value(user, subtract_values(money_value, cost))
    setattr(user, meta["field"], getattr(user, meta["field"], 0) + amount)
    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user


def apply_rebirth_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    meta = get_rebirth_upgrade_meta(key)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Increase amount must be at least 1")
    cost = calculate_rebirth_upgrade_cost(user, key, amount)
    rebirths = getattr(user, "rebirth_count", 0) or 0
    if rebirths < cost:
        raise HTTPException(status_code=400, detail="환생이 부족합니다.")
    setattr(user, "rebirth_count", rebirths - cost)
    setattr(user, meta["field"], getattr(user, meta["field"], 0) + amount)
    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user


def calculate_polynomial_cost(user: User, config: dict, key: str, amount: int = 1) -> BigValue:
    meta = config[key]
    current_level = getattr(user, meta["field"], 0)
    base_cost = meta["base_cost"]
    price_growth = meta["price_growth"]
    
    total_cost = from_plain(0)
    
    for i in range(amount):
        level_to_buy = current_level + i
        
        # New formula: cost = base_cost * (price_growth ** level)
        growth_bv = from_plain(price_growth)
        growth_pow_level_bv = power_int(growth_bv, level_to_buy)

        cost_for_level = multiply_values(base_cost, growth_pow_level_bv)
        total_cost = add_values(total_cost, cost_for_level)
        
    return total_cost

def calculate_polynomial_cost_int(user: User, config: dict, key: str, amount: int = 1) -> int:
    meta = config[key]
    current_level = getattr(user, meta["field"], 0)
    base_cost = meta["base_cost"]
    price_growth = meta["price_growth"]

    total_cost = 0

    for i in range(amount):
        level_to_buy = current_level + i
        # New formula: cost = base_cost * (price_growth ** level)
        cost_for_level = base_cost * (price_growth ** level_to_buy)
        total_cost += cost_for_level
        
    return int(total_cost)

def apply_poly_sparkle_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    meta = SPARKLE_UPGRADE_CONFIG[key]
    cost = calculate_polynomial_cost(user, SPARKLE_UPGRADE_CONFIG, key, amount)
    sparkle_value = get_user_electronic_sparkle_value(user)

    if compare(sparkle_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough sparkles")

    set_user_electronic_sparkle_value(user, subtract_values(sparkle_value, cost))
    
    current_level = getattr(user, meta["field"], 0)
    
    max_level = meta.get("max_level")
    if max_level is not None and (current_level + amount > max_level):
        raise HTTPException(status_code=400, detail="Max level reached")

    setattr(user, meta["field"], current_level + amount)

    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user

def apply_poly_money_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    meta = MONEY_UPGRADE_POLY_CONFIG[key]
    cost = calculate_polynomial_cost(user, MONEY_UPGRADE_POLY_CONFIG, key, amount)
    money_value = get_user_money_value(user)

    if compare(money_value, cost) < 0:
        raise HTTPException(status_code=400, detail="Not enough money")

    set_user_money_value(user, subtract_values(money_value, cost))

    current_level = getattr(user, meta["field"], 0)
    setattr(user, meta["field"], current_level + amount)

    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user

def apply_poly_rebirth_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    meta = REBIRTH_UPGRADE_POLY_CONFIG[key]
    cost = calculate_polynomial_cost_int(user, REBIRTH_UPGRADE_POLY_CONFIG, key, amount)
    rebirths = getattr(user, "rebirth_count", 0) or 0

    if rebirths < cost:
        raise HTTPException(status_code=400, detail="Not enough rebirth points")

    setattr(user, "rebirth_count", rebirths - cost)

    current_level = getattr(user, meta["field"], 0)
    setattr(user, meta["field"], current_level + amount)

    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user


def calculate_proton_upgrade_cost(user: User, key: str, amount: int = 1) -> BigValue:
    """Calculate cost for Proton upgrades (exponential or linear-exponential)"""
    meta = PROTON_UPGRADE_CONFIG[key]
    current_level = getattr(user, meta["field"], 0)
    base_cost = meta["base_cost"]
    multiplier_base = meta["multiplier_base"]
    upgrade_type = meta.get("type", "exponential")
    
    total_cost = from_plain(0)
    
    for i in range(amount):
        level_to_buy = current_level + i
        
        # New formula: Cost = base_cost * (multiplier_base ^ level)
        multiplier = power_int(multiplier_base, level_to_buy)
        cost_for_level = multiply_values(base_cost, multiplier)
        
        total_cost = add_values(total_cost, cost_for_level)
    
    return total_cost


def apply_proton_upgrade(user: User, db: Session, key: str, amount: int, *, commit: bool = True) -> User:
    """Apply Proton upgrade"""
    meta = PROTON_UPGRADE_CONFIG[key]
    cost = calculate_proton_upgrade_cost(user, key, amount)
    proton_value = get_user_proton_value(user)
    
    if compare(proton_value, cost) < 0:
        raise HTTPException(status_code=400, detail="양성자가 부족합니다.")
    
    set_user_proton_value(user, subtract_values(proton_value, cost))
    
    current_level = getattr(user, meta["field"], 0)
    setattr(user, meta["field"], current_level + amount)
    
    if commit:
        db.commit()
        db.refresh(user)
    else:
        db.flush()
    return user


def calculate_money_to_proton_rate(user: User) -> BigValue:
    """Calculate Money to Proton exchange rate (BigValue)"""
    base_rate = from_plain(1)  # 1 Money = 1 Proton
    
    # Apply proton gain upgrades
    money_upgrade_level = getattr(user, "proton_gain_money_upgrade", 0) or 0
    rebirth_upgrade_level = getattr(user, "proton_gain_rebirth_upgrade", 0) or 0
    special_upgrade_level = getattr(user, "proton_gain_special_upgrade", 0) or 0
    
    # Money upgrade: * 2 per level (2^level)
    if money_upgrade_level > 0:
        multiplier = power_int(from_plain(2), money_upgrade_level)
        base_rate = multiply_values(base_rate, multiplier)
    
    # Rebirth upgrade: * 1000 per level (1000^level)
    if rebirth_upgrade_level > 0:
        multiplier = power_int(from_plain(1000), rebirth_upgrade_level)
        base_rate = multiply_values(base_rate, multiplier)
    
    # Special upgrade: * 1000 per level (1000^level)
    if special_upgrade_level > 0:
        multiplier = power_int(from_plain(1000), special_upgrade_level)
        base_rate = multiply_values(base_rate, multiplier)
    
    return base_rate

