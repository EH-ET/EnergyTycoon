from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..models import User
from ..bigvalue import get_user_money_value, get_user_energy_value, get_user_electronic_sparkle_value, get_user_proton_value, normalize

router = APIRouter()


def _user_score(u: User, criteria: str = "money"):
    """Calculate user score based on criteria.

    For BigValue types (money, energy), returns dict with {data, high, displayValue}.
    For other types, returns int.
    """
    if criteria == "energy":
        bv = normalize(get_user_energy_value(u))
        # Return BigValue components for safe display
        return {
            "data": bv.data,
            "high": bv.high,
            "displayValue": f"{bv.data}e{bv.high}" if bv.high > 0 else str(bv.data)
        }
    elif criteria == "sparkle":
        bv = normalize(get_user_electronic_sparkle_value(u))
        return {
            "data": bv.data,
            "high": bv.high,
            "displayValue": f"{bv.data}e{bv.high}" if bv.high > 0 else str(bv.data)
        }
    elif criteria == "proton":
        bv = normalize(get_user_proton_value(u))
        return {
            "data": bv.data,
            "high": bv.high,
            "displayValue": f"{bv.data}e{bv.high}" if bv.high > 0 else str(bv.data)
        }
    elif criteria == "playtime":
        return getattr(u, 'play_time_ms', 0) or 0
    elif criteria == "rebirth":
        return getattr(u, 'rebirth_count', 0) or 0
    elif criteria == "supercoin":
        return getattr(u, 'supercoin', 0) or 0
    else:  # money (default)
        bv = normalize(get_user_money_value(u))
        # Return BigValue components for safe display
        return {
            "data": bv.data,
            "high": bv.high,
            "displayValue": f"{bv.data}e{bv.high}" if bv.high > 0 else str(bv.data)
        }


def _get_order_by(criteria: str):
    """Get SQLAlchemy order_by clause based on criteria."""
    if criteria == "energy":
        return [User.energy_high.desc(), User.energy_data.desc(), User.user_id]
    elif criteria == "sparkle":
        return [User.electronic_sparkle_high.desc(), User.electronic_sparkle_data.desc(), User.user_id]
    elif criteria == "proton":
        return [User.proton_high.desc(), User.proton_data.desc(), User.user_id]
    elif criteria == "playtime":
        return [User.play_time_ms.desc(), User.user_id]
    elif criteria == "rebirth":
        return [User.rebirth_count.desc(), User.money_high.desc(), User.money_data.desc(), User.user_id]
    elif criteria == "supercoin":
        return [User.supercoin.desc(), User.money_high.desc(), User.money_data.desc(), User.user_id]
    else:  # money (default)
        return [User.money_high.desc(), User.money_data.desc(), User.user_id]


CRITERIA = ["money", "sparkle", "energy", "rebirth", "supercoin", "playtime", "proton"]

@router.get("/rank/me", summary="Get current user's rank for all criteria")
async def get_my_total_rank(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    
    my_ranks = {}
    
    for criteria in CRITERIA:
        order_clause = _get_order_by(criteria)
        # This is inefficient, but matches original logic.
        # A better implementation would use window functions.
        ordered = db.query(User.user_id).order_by(*order_clause).all()
        
        found_rank = -1
        for idx, u in enumerate(ordered):
            if u.user_id == user.user_id:
                found_rank = idx + 1
                break
        
        if found_rank != -1:
            my_ranks[criteria] = {
                "rank": found_rank,
                "score": _user_score(user, criteria)
            }
        else:
            my_ranks[criteria] = {
                "rank": -1, "score": _user_score(user, criteria)
            }
            
    return my_ranks


@router.get("/ranks/all", summary="Get top ranks for all criteria")
async def get_all_ranks(limit: int = 100, offset: int = 0, auth=Depends(get_user_and_db)):
    _, db, _ = auth
    
    if limit <= 0 or offset < 0:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
        
    all_ranks = {}
    
    for criteria in CRITERIA:
        order_clause = _get_order_by(criteria)
        base_query = db.query(User).order_by(*order_clause)
        total = base_query.count()
        users = base_query.offset(offset).limit(limit).all()
        
        ranks_data = [{"username": u.username, "rank": offset + i + 1, "score": _user_score(u, criteria)} for i, u in enumerate(users)]
        
        all_ranks[criteria] = {
            "total": total,
            "limit": limit,
            "offset": offset,
            "ranks": ranks_data
        }
        
    return all_ranks

