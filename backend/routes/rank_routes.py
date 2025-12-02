from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import get_user_and_db
from ..models import User
from ..bigvalue import get_user_money_value, to_plain

router = APIRouter()


def _user_score(u: User) -> int:
    return to_plain(get_user_money_value(u))


@router.get("/rank")
async def rank(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    ordered = db.query(User).order_by(User.money_high.desc(), User.money_data.desc(), User.user_id).all()
    for idx, u in enumerate(ordered):
        if u.user_id == user.user_id:
            return {"username": u.username, "rank": idx + 1, "score": _user_score(u)}
    raise HTTPException(status_code=404, detail="User not found")


@router.get("/ranks")
async def ranks(limit: int = 100, offset: int = 0, auth=Depends(get_user_and_db)):
    _, db, _ = auth
    if limit <= 0 or offset < 0:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    base_query = db.query(User).order_by(User.money_high.desc(), User.money_data.desc(), User.user_id)
    total = base_query.count()
    users = base_query.offset(offset).limit(limit).all()
    out = [{"username": u.username, "rank": offset + i + 1, "score": _user_score(u)} for i, u in enumerate(users)]
    return {"total": total, "limit": limit, "offset": offset, "ranks": out}
