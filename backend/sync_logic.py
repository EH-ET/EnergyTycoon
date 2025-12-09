from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

from .bigvalue import (
    BigValue,
    add_values,
    ensure_user_big_values,
    from_payload,
    get_user_energy_value,
    get_user_money_value,
    normalize,
    set_user_energy_value,
    set_user_money_value,
)
from .models import User

SYNC_TOLERANCE = 0.02  # 2% difference allowed for optimistic client values


def load_user_state(user: User) -> Dict[str, Any]:
    ensure_user_big_values(user)
    return {
        "money": get_user_money_value(user),
        "energy": get_user_energy_value(user),
        "production_bonus": getattr(user, "production_bonus", 0) or 0,
        "heat_reduction": getattr(user, "heat_reduction", 0) or 0,
        "tolerance_bonus": getattr(user, "tolerance_bonus", 0) or 0,
        "demand_bonus": getattr(user, "demand_bonus", 0) or 0,
    }


def apply_action_to_state(state: Dict[str, Any], action: Dict[str, Any]) -> Dict[str, Any]:
    a_type = action.get("type")
    payload = action.get("payload") or {}

    if a_type == "upgrade":
        field = payload.get("field")
        amount = int(payload.get("amount", 1) or 1)
        if amount < 1:
            raise ValueError("Invalid upgrade amount")
        if field not in ("production_bonus", "heat_reduction", "tolerance_bonus", "demand_bonus"):
            raise ValueError("Invalid upgrade field")
        state[field] = (state.get(field) or 0) + amount
    elif a_type == "collect_money":
        delta_payload = payload.get("money_delta")
        delta: BigValue = from_payload(
            (delta_payload or {}).get("data"),
            (delta_payload or {}).get("high"),
            0,
        )
        state["money"] = add_values(state["money"], delta)
    elif a_type == "collect_energy":
        delta_payload = payload.get("energy_delta")
        delta: BigValue = from_payload(
            (delta_payload or {}).get("data"),
            (delta_payload or {}).get("high"),
            0,
        )
        state["energy"] = add_values(state["energy"], delta)
    # Other action types can be added as needed

    return state


def _within_tolerance(server_val: BigValue, client_val: Dict[str, int]) -> bool:
    if client_val is None:
        return True
    s = normalize(server_val)
    c = normalize(
        BigValue(
            int(client_val.get("data", 0)),
            int(client_val.get("high", 0)),
        )
    )
    if s.high != c.high:
        return False
    base = max(1, s.data)
    diff = abs(s.data - c.data) / base
    return diff <= SYNC_TOLERANCE


def validate_client_state(state: Dict[str, Any], client_state: Dict[str, Any]) -> bool:
    try:
        if not _within_tolerance(state["money"], client_state.get("money")):
            return False
        if not _within_tolerance(state["energy"], client_state.get("energy")):
            return False
    except Exception:
        return False
    return True


def persist_user_state(db: Session, user: User, state: Dict[str, Any]) -> User:
    user.production_bonus = state.get("production_bonus", 0)
    user.heat_reduction = state.get("heat_reduction", 0)
    user.tolerance_bonus = state.get("tolerance_bonus", 0)
    user.demand_bonus = state.get("demand_bonus", 0)
    set_user_money_value(user, state["money"])
    set_user_energy_value(user, state["energy"])
    db.commit()
    db.refresh(user)
    return user
