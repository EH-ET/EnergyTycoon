from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_user_and_db
from ..schemas import UserOut

router = APIRouter()


def apply_special_upgrade(user, db, upgrade_type: str):
    """
    Apply special upgrade using supercoin (fixed cost: 1 supercoin)
    
    Args:
        user: User instance
        db: Database session
        upgrade_type: Type of special upgrade ('build_speed', 'energy_mult', 'exchange_mult')
    
    Returns:
        Updated user
    """
    # Check supercoin
    if user.supercoin < 1:
        raise HTTPException(status_code=400, detail="슈퍼코인이 부족합니다.")
    
    # Check max level
    if upgrade_type == "build_speed":
        current_level = user.build_speed_reduction
        max_level = 9
        if current_level >= max_level:
            raise HTTPException(status_code=400, detail="최대 레벨에 도달했습니다.")
        user.build_speed_reduction += 1
    elif upgrade_type == "energy_mult":
        user.energy_multiplier += 1
    elif upgrade_type == "exchange_mult":
        user.exchange_rate_multiplier += 1
    else:
        raise HTTPException(status_code=400, detail="잘못된 업그레이드 타입입니다.")
    
    # Deduct supercoin
    user.supercoin -= 1
    
    db.commit()
    db.refresh(user)
    return user


@router.post("/special/build_speed")
async def upgrade_build_speed(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_special_upgrade(user, db, "build_speed")
    return UserOut.model_validate(upgraded_user)


@router.post("/special/energy_mult")
async def upgrade_energy_mult(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_special_upgrade(user, db, "energy_mult")
    return UserOut.model_validate(upgraded_user)


@router.post("/special/exchange_mult")
async def upgrade_exchange_mult(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_special_upgrade(user, db, "exchange_mult")
    return UserOut.model_validate(upgraded_user)
