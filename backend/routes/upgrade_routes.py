from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_user_and_db
from ..game_logic import apply_upgrade
from ..schemas import UpgradeRequest, UserOut

router = APIRouter()


def _amount_from_payload(payload: UpgradeRequest | None) -> int:
    return payload.amount if payload else 1


def _sync_energy(user, payload: UpgradeRequest | None):
    if payload and payload.energy is not None:
        if payload.energy < 0:
            raise HTTPException(status_code=400, detail="Energy cannot be negative")
        user.energy = payload.energy


@router.post("/upgrade/production")
async def upgrade_production(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _sync_energy(user, payload)
    upgraded_user = apply_upgrade(user, db, "production", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/heat_reduction")
async def upgrade_heat_reduction(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _sync_energy(user, payload)
    upgraded_user = apply_upgrade(user, db, "heat_reduction", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/tolerance")
async def upgrade_tolerance(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _sync_energy(user, payload)
    upgraded_user = apply_upgrade(user, db, "tolerance", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/max_generators")
async def upgrade_max_generators(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _sync_energy(user, payload)
    upgraded_user = apply_upgrade(user, db, "max_generators", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)


@router.post("/upgrade/supply")
async def upgrade_supply(payload: UpgradeRequest | None = None, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    _sync_energy(user, payload)
    upgraded_user = apply_upgrade(user, db, "supply", _amount_from_payload(payload))
    return UserOut.model_validate(upgraded_user)
