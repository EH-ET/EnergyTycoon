import os
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

LOGIN_COOLDOWN_SECONDS = float(os.getenv("LOGIN_COOLDOWN_SECONDS", "1.0"))
MAX_BACKOFF_SECONDS = float(os.getenv("MAX_BACKOFF_SECONDS", "300"))  # 5 minutes max
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
_login_backoff: dict[str, float] = {}
_login_failure_count: dict[str, int] = {}  # Track consecutive failures for exponential backoff
_ip_buckets = defaultdict(list)
IP_MAX_ATTEMPTS = int(os.getenv("IP_MAX_ATTEMPTS", "100"))
IP_WINDOW_SECONDS = int(os.getenv("IP_WINDOW_SECONDS", "60"))
MAX_BACKOFF_ENTRIES = 10000  # Prevent unbounded memory growth
MAX_IP_ENTRIES = 10000


def _cleanup_old_entries():
    """Remove old entries from rate limiting dicts to prevent memory exhaustion."""
    now = time.time()
    
    # Clean up login backoff entries older than cooldown period
    if len(_login_backoff) > MAX_BACKOFF_ENTRIES:
        to_remove = [
            username for username, timestamp in _login_backoff.items()
            if now - timestamp > LOGIN_COOLDOWN_SECONDS * 2
        ]
        for username in to_remove[:len(_login_backoff) // 2]:  # Remove half if over limit
            _login_backoff.pop(username, None)
            _login_failure_count.pop(username, None)
    
    # Clean up IP bucket entries
    if len(_ip_buckets) > MAX_IP_ENTRIES:
        to_remove = [
            ip for ip, timestamps in _ip_buckets.items()
            if not timestamps or all(ts < now - IP_WINDOW_SECONDS * 2 for ts in timestamps)
        ]
        for ip in to_remove[:len(_ip_buckets) // 2]:  # Remove half if over limit
            _ip_buckets.pop(ip, None)


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
    """Enforce exponential backoff based on consecutive failed login attempts."""
    if not username:
        return
    last_fail = _login_backoff.get(username)
    if last_fail is None:
        return
    
    # Calculate exponential backoff: base_cooldown * (2 ^ failure_count)
    failure_count = _login_failure_count.get(username, 0)
    cooldown = min(LOGIN_COOLDOWN_SECONDS * (2 ** failure_count), MAX_BACKOFF_SECONDS)
    
    elapsed = time.time() - last_fail
    if elapsed < cooldown:
        wait_time = int(cooldown - elapsed)
        raise HTTPException(
            status_code=429, 
            detail=f"Too many failed attempts. Please wait {wait_time} seconds."
        )


def _mark_login_failure(username: str | None):
    """Mark a failed login attempt and increment failure count for exponential backoff."""
    if username:
        _login_backoff[username] = time.time()
        _login_failure_count[username] = _login_failure_count.get(username, 0) + 1
        _cleanup_old_entries()


def _clear_login_failure(username: str | None):
    """Clear failed login tracking on successful authentication."""
    if username:
        _login_backoff.pop(username, None)
        _login_failure_count.pop(username, None)


def _check_ip_rate(request: Request):
    ip = request.client.host if request and request.client else "unknown"
    now = time.time()
    recent = [ts for ts in _ip_buckets[ip] if ts > now - IP_WINDOW_SECONDS]
    if len(recent) >= IP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait.")
    recent.append(now)
    _ip_buckets[ip] = recent
    _cleanup_old_entries()


def _validate_username(username: str):
    """Validate username to prevent XSS and other attacks."""
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be at most 20 characters")
    # Only allow alphanumeric characters and underscores
    if not all(c.isalnum() or c == '_' for c in username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")


@router.post("/signup")
async def signup(
    request: Request, response: Response, payload: schemas.UserCreate, db: Session = Depends(get_db)
):
    _check_ip_rate(request)
    _validate_username(payload.username)
    _validate_password_strength(payload.password)
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    u = User(
        username=payload.username, 
        password=hash_pw(payload.password), 
        rebirth_count=0,
        energy_data=0,
        energy_high=0,
        money_data=10000,
        money_high=0
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    # ensure_user_big_values(u, db)  # Redundant as we initialize them above
    access_token, refresh_token = issue_token_pair(u, db)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
        set_csrf_cookie(response)
    return {
        "user": schemas.UserOut.model_validate(u),
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
    ensure_user_big_values(.user, db)
    access_token, refresh_token = issue_token_pair(user, db)
    if response:
        clear_auth_cookies(response)
        set_auth_cookies(response, access_token, refresh_token)
        set_trap_cookie(response)
        set_csrf_cookie(response)
    return {
        "user": schemas.UserOut.model_validate(user),
    }


@router.get("/csrf-token")
async def get_csrf_token(response: Response):
    """Get a fresh CSRF token - useful when CSRF token expires"""
    csrf_token = set_csrf_cookie(response) if response else None
    return {"csrf_token": csrf_token, "detail": "CSRF token issued"}


@router.get("/csrf")
async def get_csrf_token_alias(response: Response):
    """Alias for /csrf-token for backwards compatibility"""
    csrf_token = set_csrf_cookie(response) if response else None
    return {"csrf_token": csrf_token, "detail": "CSRF token issued"}


@router.post("/logout")
async def logout(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, db, _ = auth
    revoke_user_tokens(user.user_id, db)
    if response:
        clear_auth_cookies(response)
    return {"detail": "Logout successful"}


@router.post("/refresh/access")
async def refresh_access(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, db, refresh_token_used = auth
    access_token = issue_access_token(user.user_id)
    new_refresh = issue_refresh_token(user, db)
    if response:
        revoke_token(refresh_token_used, db)
        clear_auth_cookies(response, keep_trap=True)
        set_auth_cookies(response, access_token, new_refresh)
        set_csrf_cookie(response)
    return {"detail": "access token refreshed"}


@router.post("/refresh/refresh")
async def refresh_refresh(response: Response, auth=Depends(get_refresh_user_and_db)):
    user, db, token = auth
    revoke_token(token, db)
    access_token = issue_access_token(user.user_id)
    refresh_token = issue_refresh_token(user, db)
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
    revoke_user_tokens(user.user_id, db)
    db.delete(user)
    db.commit()
    clear_auth_cookies(response)
    return {"detail": "Account deleted"}