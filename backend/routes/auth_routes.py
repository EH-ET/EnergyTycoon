from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..auth_utils import (
    hash_pw,
    issue_access_token,
    issue_refresh_token,
    issue_token_pair,
    revoke_token,
    revoke_user_tokens,
)
from ..dependencies import get_db, get_refresh_user_and_db
from ..models import User

router = APIRouter()


@router.post("/signup")
async def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    u = User(username=payload.username, password=hash_pw(payload.password), energy=0, money=10)
    db.add(u)
    db.commit()
    db.refresh(u)
    access_token, refresh_token = issue_token_pair(u.user_id)
    return {"user": schemas.UserOut.model_validate(u), "access_token": access_token, "refresh_token": refresh_token}


@router.post("/login")
async def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.password != hash_pw(payload.password):
        raise HTTPException(status_code=400, detail="Invalid password")
    access_token, refresh_token = issue_token_pair(user.user_id)
    return {"user": schemas.UserOut.model_validate(user), "access_token": access_token, "refresh_token": refresh_token}


@router.post("/logout")
async def logout(auth=Depends(get_refresh_user_and_db)):
    user, _, _ = auth
    revoke_user_tokens(user.user_id)
    return {"detail": "Logout successful"}


@router.post("/refresh/access")
async def refresh_access(auth=Depends(get_refresh_user_and_db)):
    user, _, _ = auth
    access_token = issue_access_token(user.user_id)
    return {"access_token": access_token}


@router.post("/refresh/refresh")
async def refresh_refresh(auth=Depends(get_refresh_user_and_db)):
    user, _, token = auth
    revoke_token(token)
    access_token = issue_access_token(user.user_id)
    refresh_token = issue_refresh_token(user.user_id)
    return {"access_token": access_token, "refresh_token": refresh_token}
