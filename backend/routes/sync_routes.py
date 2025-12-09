from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..schemas import UserOut
from ..sync_logic import (
    apply_action_to_state,
    load_user_state,
    persist_user_state,
    validate_client_state,
)

router = APIRouter()


class ActionPayload(BaseModel):
    type: str = Field(..., description="upgrade | collect_money | collect_energy | ...")
    payload: dict = Field(default_factory=dict)
    ts: int | None = None


class ClientState(BaseModel):
    energy: dict
    money: dict
    production_bonus: int | None = 0
    heat_reduction: int | None = 0
    tolerance_bonus: int | None = 0
    demand_bonus: int | None = 0
    timestamp: int


class SyncRequest(BaseModel):
    actions: list[ActionPayload] = Field(default_factory=list)
    clientState: ClientState


@router.post("/sync", response_model=UserOut)
async def sync_progress(payload: SyncRequest, auth=Depends(get_user_and_db)):
    user, db, _ = auth  # type: ignore
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    state = load_user_state(user)

    for action in payload.actions:
        try:
            state = apply_action_to_state(state, action.model_dump())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not validate_client_state(state, payload.clientState.model_dump()):
        raise HTTPException(status_code=409, detail="Client state out of sync")

    user = persist_user_state(db, user, state)
    return UserOut.model_validate(user)
