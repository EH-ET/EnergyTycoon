from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_user_and_db
from ..game_logic import apply_upgrade, apply_rebirth_upgrade
from ..schemas import UpgradeRequest, BulkUpgradeRequest, UserOut

router = APIRouter()


def _amount_from_payload(payload: UpgradeRequest | None) -> int:
    return payload.amount if payload else 1


@router.post("/upgrade/production")
async def upgrade_production(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "production", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/heat_reduction")
async def upgrade_heat_reduction(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "heat_reduction", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/tolerance")
async def upgrade_tolerance(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "tolerance", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/max_generators")
async def upgrade_max_generators(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "max_generators", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/demand")
async def upgrade_demand(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "demand", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/rebirth_chain")
async def upgrade_rebirth_chain(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_rebirth_upgrade(user, db, "rebirth_chain", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/upgrade_batch")
async def upgrade_upgrade_batch(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_rebirth_upgrade(user, db, "upgrade_batch", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/rebirth_start_money")
async def upgrade_rebirth_start_money(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_rebirth_upgrade(user, db, "rebirth_start_money", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


# Endpoint mapping for bulk upgrades
UPGRADE_TYPE_MAP = {
    "production": ("upgrade", "production"),
    "heat_reduction": ("upgrade", "heat_reduction"),
    "tolerance": ("upgrade", "tolerance"),
    "max_generators": ("upgrade", "max_generators"),
    "demand": ("upgrade", "demand"),
    "rebirth_chain": ("rebirth", "rebirth_chain"),
    "upgrade_batch": ("rebirth", "upgrade_batch"),
    "rebirth_start_money": ("rebirth", "rebirth_start_money"),
}


@router.post("/upgrade/bulk")
async def bulk_upgrade(payload: BulkUpgradeRequest, auth=Depends(get_user_and_db)):
    """
    Bulk upgrade endpoint - applies multiple upgrades in one request
    """
    user, db, _ = auth

    # Apply all upgrades sequentially
    for upgrade_item in payload.upgrades:
        endpoint = upgrade_item.endpoint
        amount = upgrade_item.amount

        if endpoint not in UPGRADE_TYPE_MAP:
            raise HTTPException(status_code=400, detail=f"Invalid upgrade endpoint: {endpoint}")

        upgrade_type, upgrade_name = UPGRADE_TYPE_MAP[endpoint]

        if upgrade_type == "upgrade":
            user = apply_upgrade(user, db, upgrade_name, amount)
        elif upgrade_type == "rebirth":
            user = apply_rebirth_upgrade(user, db, upgrade_name, amount)

    return {"user": UserOut.model_validate(user)}
