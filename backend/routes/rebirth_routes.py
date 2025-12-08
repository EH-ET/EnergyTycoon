from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_user_and_db
from ..models import MapProgress, Generator
from ..schemas import RebirthRequest, UserOut
from ..bigvalue import (
    get_user_money_value,
    set_user_money_value,
    set_user_energy_value,
    from_plain,
    multiply_plain,
    compare,
    to_payload,
    BigValue,
)

router = APIRouter()

# Rebirth cost formula: 15M × 8^n (where n = current rebirth count)
BASE_REBIRTH_COST = 15_000_000  # 15M


def calculate_rebirth_cost(rebirth_count: int) -> BigValue:
    """Calculate rebirth cost using formula: 15M × 8^n"""
    multiplier = 8 ** rebirth_count
    cost_plain = BASE_REBIRTH_COST * multiplier
    return from_plain(cost_plain)


def calculate_rebirth_multiplier(rebirth_count: int) -> int:
    """Calculate production/exchange rate multiplier: 2^n"""
    return 2 ** rebirth_count


def calculate_rebirth_start_money(user) -> BigValue:
    """Calculate starting money after rebirth using rebirth_start_money_upgrade."""
    level = getattr(user, "rebirth_start_money_upgrade", 0) or 0
    value = from_plain(10)
    for _ in range(level):
        value = multiply_plain(value, 10)
    return value


@router.get("/rebirth/info")
async def get_rebirth_info(auth=Depends(get_user_and_db)):
    """Get current rebirth information for the user"""
    user, db, _ = auth
    
    current_count = getattr(user, "rebirth_count", 0) or 0
    max_chain = max(1, 1 + (getattr(user, "rebirth_chain_upgrade", 0) or 0))
    chain_target_count = current_count + max_chain - 1
    next_cost = calculate_rebirth_cost(current_count)
    chain_cost = calculate_rebirth_cost(chain_target_count)
    current_multiplier = calculate_rebirth_multiplier(current_count)
    next_multiplier = calculate_rebirth_multiplier(current_count + 1)
    
    cost_payload = to_payload(next_cost)
    chain_cost_payload = to_payload(chain_cost)
    start_money_payload = to_payload(calculate_rebirth_start_money(user))
    
    return {
        "user": UserOut.model_validate(user),
        "rebirth_count": current_count,
        "next_cost_data": cost_payload["data"],
        "next_cost_high": cost_payload["high"],
        "current_multiplier": current_multiplier,
        "next_multiplier": next_multiplier,
        "max_chain": max_chain,
        "chain_cost_data": chain_cost_payload["data"],
        "chain_cost_high": chain_cost_payload["high"],
        "start_money_data": start_money_payload["data"],
        "start_money_high": start_money_payload["high"],
        "upgrade_batch_limit": 1 + (getattr(user, "upgrade_batch_upgrade", 0) or 0),
    }


@router.post("/rebirth")
async def perform_rebirth(payload: RebirthRequest | None = None, auth=Depends(get_user_and_db)):
    """Perform rebirth - reset progress in exchange for permanent multipliers"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        user, db, _ = auth
        amount = payload.count if payload else 1
        if amount < 1:
            raise HTTPException(status_code=400, detail="환생 횟수는 1 이상이어야 합니다.")
        
        # Use FOR UPDATE to lock the user row
        user = db.query(type(user)).filter_by(user_id=user.user_id).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        max_chain = max(1, 1 + (getattr(user, "rebirth_chain_upgrade", 0) or 0))
        if amount > max_chain:
            raise HTTPException(status_code=400, detail=f"한 번에 최대 {max_chain}회까지 환생할 수 있습니다.")
        
        current_count = getattr(user, "rebirth_count", 0) or 0
        target_rebirth_index = current_count + amount - 1
        rebirth_cost = calculate_rebirth_cost(target_rebirth_index)
        money_value = get_user_money_value(user)
        
        # Check if user has enough money
        if compare(money_value, rebirth_cost) < 0:
            raise HTTPException(status_code=400, detail="Not enough money for rebirth")
        
        # Calculate new multiplier
        new_multiplier = calculate_rebirth_multiplier(current_count + amount)
        
        # Delete all generators and map progress
        db.query(MapProgress).filter(MapProgress.user_id == user.user_id).delete()
        db.query(Generator).filter(Generator.owner_id == user.user_id).delete()
        
        # Reset upgrades
        user.production_bonus = 0
        user.heat_reduction = 0
        user.tolerance_bonus = 0
        user.max_generators_bonus = 0
        user.demand_bonus = 0
        
        # Reset energy to 0
        set_user_energy_value(user, from_plain(0))
        
        # Reset money to upgraded starting amount
        set_user_money_value(user, calculate_rebirth_start_money(user))
        
        # Increment rebirth count
        user.rebirth_count = current_count + amount
        
        # Reset user's sold_energy (per-user market state)
        user.sold_energy_data = 0
        user.sold_energy_high = 0
        
        db.commit()
        db.refresh(user)
        
        return {
            "user": UserOut.model_validate(user),
            "message": f"Rebirth successful! New multiplier: {new_multiplier}x (x{amount})"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rebirth error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Rebirth failed: {str(e)}")
