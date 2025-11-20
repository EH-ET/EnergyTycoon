from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import schemas
from ..auth_utils import (
    clear_auth_cookies,
    hash_pw,
    issue_access_token,
    issue_refresh_token,
    issue_token_pair,
    password_needs_rehash,
    revoke_token,
    revoke_user_tokens,
    set_auth_cookies,
    set_trap_cookie,
    verify_password,
)
from ..dependencies import get_db, get_refresh_user_and_db
from ..models import User

router = APIRouter()


@router.post("/signup")
async def signup(response: Response, payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    u = User(username=payload.username, password=hash_pw(payload.password), energy=0, money=10)
    db.add(u)
    db.commit()
    db.refresh(u)
    access_token, refresh_token = issue_token_pair(u.user_id)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
    return {"user": schemas.UserOut.model_validate(u), "access_token": access_token, "refresh_token": refresh_token}


@router.post("/login")
async def login(response: Response, payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid password")
    if password_needs_rehash(user.password):
        user.password = hash_pw(payload.password)
        db.commit()
        db.refresh(user)
    access_token, refresh_token = issue_token_pair(user.user_id)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
    return {"user": schemas.UserOut.model_validate(user), "access_token": access_token, "refresh_token": refresh_token}


@router.post("/logout")
async def logout(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, _, _ = auth
    revoke_user_tokens(user.user_id)
    if response:
        clear_auth_cookies(response)
    return {"detail": "Logout successful"}


@router.post("/refresh/access")
async def refresh_access(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, _, refresh_token_used = auth
    access_token = issue_access_token(user.user_id)
    new_refresh = issue_refresh_token(user.user_id)
    if response:
        revoke_token(refresh_token_used)
        clear_auth_cookies(response, keep_trap=True)
        set_auth_cookies(response, access_token, new_refresh)
    return {"access_token": access_token}


@router.post("/refresh/refresh")
async def refresh_refresh(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, _, token = auth
    revoke_token(token)
    access_token = issue_access_token(user.user_id)
    refresh_token = issue_refresh_token(user.user_id)
    if response:
        clear_auth_cookies(response, keep_trap=True)
        set_auth_cookies(response, access_token, refresh_token)
    return {"access_token": access_token, "refresh_token": refresh_token}
