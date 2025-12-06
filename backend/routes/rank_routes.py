from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..models import User
from ..bigvalue import get_user_money_value, get_user_energy_value, normalize

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
    elif criteria == "playtime":
        return [User.play_time_ms.desc(), User.user_id]
    elif criteria == "rebirth":
        return [User.rebirth_count.desc(), User.money_high.desc(), User.money_data.desc(), User.user_id]
    elif criteria == "supercoin":
        return [User.supercoin.desc(), User.money_high.desc(), User.money_data.desc(), User.user_id]
    else:  # money (default)
        return [User.money_high.desc(), User.money_data.desc(), User.user_id]


@router.get("/rank")
async def rank(criteria: str = "money", auth=Depends(get_user_and_db)):
    user, db, _ = auth
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching rank for user {user.username} with criteria: {criteria}")
    
    order_clause = _get_order_by(criteria)
    logger.info(f"Order clause: {order_clause}")
    
    ordered = db.query(User).order_by(*order_clause).all()
    for idx, u in enumerate(ordered):
        if u.user_id == user.user_id:
            score = _user_score(u, criteria)
            logger.info(f"User {user.username} rank: {idx + 1}, score: {score}, criteria: {criteria}")
            return {"username": u.username, "rank": idx + 1, "score": score, "criteria": criteria}
    raise HTTPException(status_code=404, detail="User not found")


@router.get("/ranks")
async def ranks(limit: int = 100, offset: int = 0, criteria: str = "money", auth=Depends(get_user_and_db)):
    _, db, _ = auth
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching ranks with criteria: {criteria}, limit: {limit}, offset: {offset}")
    
    if limit <= 0 or offset < 0:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    
    order_clause = _get_order_by(criteria)
    logger.info(f"Order clause: {order_clause}")
    
    base_query = db.query(User).order_by(*order_clause)
    total = base_query.count()
    users = base_query.offset(offset).limit(limit).all()
    out = [{"username": u.username, "rank": offset + i + 1, "score": _user_score(u, criteria)} for i, u in enumerate(users)]
    logger.info(f"Returning {len(out)} ranks with criteria: {criteria}")
    return {"total": total, "limit": limit, "offset": offset, "criteria": criteria, "ranks": out}
