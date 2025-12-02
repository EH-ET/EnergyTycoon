from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Rebirth, Generator, MapProgress
from ..schemas import UserOut, RebirthOut
from ..auth_utils import get_current_user
from ..bigvalue import (
    get_user_money_value,
    set_user_money_value,
    compare,
    subtract_values,
    from_plain,
    to_plain,
    to_payload,
)

router = APIRouter(prefix="/rebirth", tags=["rebirth"])

BASE_REBIRTH_COST = 1_000_000_000_000  # 1T


def calculate_rebirth_cost_value(rebirth_count: int):
    """Calculate rebirth cost as BigValue: 1T * 8^n"""
    base = BASE_REBIRTH_COST
    multiplier = 8 ** rebirth_count
    total_cost = base * multiplier
    return from_plain(total_cost)


@router.get("/info")
def get_rebirth_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rebirth information for current user"""
    rebirth_record = db.query(Rebirth).filter(Rebirth.user_id == current_user.user_id).first()
    count = rebirth_record.rebirth_count if rebirth_record else 0
    
    cost_value = calculate_rebirth_cost_value(count)
    cost_payload = to_payload(cost_value)
    
    return {
        "rebirth_count": count,
        "next_rebirth_cost": cost_payload,  # Return as BigValue payload {data, high}
        "next_rebirth_cost_plain": to_plain(cost_value),  # Also return plain for simple display
        "multiplier": 2 ** count
    }


@router.post("/", response_model=UserOut)
def perform_rebirth(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Perform rebirth: reset progress for permanent multiplier"""
    # 1. Get or create rebirth record
    rebirth_record = db.query(Rebirth).filter(Rebirth.user_id == current_user.user_id).first()
    if not rebirth_record:
        rebirth_record = Rebirth(user_id=current_user.user_id, rebirth_count=0)
        db.add(rebirth_record)
        db.commit()
        db.refresh(rebirth_record)
    
    current_rebirth_count = rebirth_record.rebirth_count
    
    # 2. Check cost using BigValue
    cost_value = calculate_rebirth_cost_value(current_rebirth_count)
    user_money_value = get_user_money_value(current_user)
    
    if compare(user_money_value, cost_value) < 0:
        cost_plain = to_plain(cost_value)
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough money for rebirth. Required: {cost_plain}"
        )
    
    # 3. Deduct cost
    new_money = subtract_values(user_money_value, cost_value)
    set_user_money_value(current_user, new_money)
    
    # 4. Reset User State
    # Reset Energy
    current_user.energy = 0
    current_user.energy_data = 0
    current_user.energy_high = 0
    
    # Reset Upgrades
    current_user.production_bonus = 0
    current_user.heat_reduction = 0
    current_user.tolerance_bonus = 0
    current_user.max_generators_bonus = 0
    current_user.demand_bonus = 0
    
    # 5. Delete Generators and MapProgress
    db.query(MapProgress).filter(MapProgress.user_id == current_user.user_id).delete()
    db.query(Generator).filter(Generator.owner_id == current_user.user_id).delete()
    
    # 6. Increment Rebirth Count
    rebirth_record.rebirth_count += 1
    
    db.commit()
    db.refresh(current_user)
    
    return current_user
