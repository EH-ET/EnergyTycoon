import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Response, Request
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
    set_csrf_cookie,
    set_trap_cookie,
    verify_password,
)
from ..dependencies import get_db, get_refresh_user_and_db, get_user_and_db
from ..models import User
from ..bigvalue import from_plain, set_user_money_value, set_user_energy_value, ensure_user_big_values

router = APIRouter()

LOGIN_COOLDOWN_SECONDS = 1.0
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
_login_backoff: dict[str, float] = {}
_ip_buckets = defaultdict(list)
IP_MAX_ATTEMPTS = 10
IP_WINDOW_SECONDS = 60


def _validate_password_strength(pw: str):
    if not pw or len(pw) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if len(pw) > MAX_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail="Password too long.")
    has_letter = any(ch.isalpha() for ch in pw)
    has_digit = any(ch.isdigit() for ch in pw)
    if not (has_letter and has_digit):
        raise HTTPException(status_code=400, detail="Password must include letters and digits.")


def _enforce_login_cooldown(username: str | None):
    if not username:
        return
    last_fail = _login_backoff.get(username)
    if last_fail is None:
        return
    if (time.time() - last_fail) < LOGIN_COOLDOWN_SECONDS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a moment.")


def _mark_login_failure(username: str | None):
    if username:
        _login_backoff[username] = time.time()


def _clear_login_failure(username: str | None):
    if username and username in _login_backoff:
        _login_backoff.pop(username, None)


def _check_ip_rate(request: Request):
    ip = request.client.host if request and request.client else "unknown"
    now = time.time()
    recent = [ts for ts in _ip_buckets[ip] if ts > now - IP_WINDOW_SECONDS]
    if len(recent) >= IP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait.")
    recent.append(now)
    _ip_buckets[ip] = recent


@router.post("/signup")
async def signup(
    request: Request, response: Response, payload: schemas.UserCreate, db: Session = Depends(get_db)
):
    _check_ip_rate(request)
    _validate_password_strength(payload.password)
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    u = User(username=payload.username, password=hash_pw(payload.password), energy=0, money=10)
    set_user_money_value(u, from_plain(10))
    set_user_energy_value(u, from_plain(0))
    db.add(u)
    db.commit()
    db.refresh(u)
    ensure_user_big_values(u, db)
    access_token, refresh_token = issue_token_pair(u.user_id)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
        set_csrf_cookie(response)
    return {
        "user": schemas.UserOut.model_validate(u),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@router.post("/login")
async def login(
    request: Request, response: Response, payload: schemas.LoginIn, db: Session = Depends(get_db)
):
    _check_ip_rate(request)
    _enforce_login_cooldown(payload.username)
    user = db.query(User).filter_by(username=payload.username).first()
    if not user:
        _mark_login_failure(payload.username)
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.password, user.password):
        _mark_login_failure(payload.username)
        raise HTTPException(status_code=400, detail="Invalid password")
    _clear_login_failure(payload.username)
    if password_needs_rehash(user.password):
        user.password = hash_pw(payload.password)
        db.commit()
        db.refresh(user)
    ensure_user_big_values(user, db)
    access_token, refresh_token = issue_token_pair(user.user_id)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
        set_csrf_cookie(response)
    return {
        "user": schemas.UserOut.model_validate(user),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


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
        set_csrf_cookie(response)
    return {"detail": "access token refreshed"}


@router.post("/refresh/refresh")
async def refresh_refresh(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, _, token = auth
    revoke_token(token)
    access_token = issue_access_token(user.user_id)
    refresh_token = issue_refresh_token(user.user_id)
    if response:
        clear_auth_cookies(response, keep_trap=True)
        set_auth_cookies(response, access_token, refresh_token)
        set_csrf_cookie(response)
    return {"detail": "token pair refreshed"}


@router.post("/delete_account")
async def delete_account(payload: schemas.DeleteAccountIn, response: Response, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if not verify_password(payload.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid password")
    revoke_user_tokens(user.user_id)
    db.delete(user)
    db.commit()
    clear_auth_cookies(response)
    return {"detail": "Account deleted"}
