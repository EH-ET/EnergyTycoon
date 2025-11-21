import hashlib
import os
import string
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import HTTPException, Response
from passlib.context import CryptContext
from sqlalchemy.orm import Session


ACCESS_TOKEN_TTL = int(os.getenv("ACCESS_TOKEN_TTL", 3600))
REFRESH_TOKEN_TTL = int(os.getenv("REFRESH_TOKEN_TTL", 86400 * 7))
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME", "ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88")
# Cookie names cannot contain "=", so we default to an obfuscated, cookie-safe variant.
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "yeCuXMndsYC3kMnAPw__")
TRAP_COOKIE_NAME = os.getenv("TRAP_COOKIE_NAME", "abtkn")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "strict")

_LEGACY_HASH_LENGTH = 64
_HEX_DIGITS = set(string.hexdigits.lower())

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)

_token_store: Dict[str, Dict[str, Any]] = {}


def generate_uuid() -> str:
    return str(uuid.uuid4())


def hash_pw(pw: str) -> str:
    return pwd_context.hash(pw)


def _is_legacy_hash(hashed: str | None) -> bool:
    if not hashed:
        return False
    if len(hashed) != _LEGACY_HASH_LENGTH:
        return False
    return all(ch in _HEX_DIGITS for ch in hashed.lower())


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    if _is_legacy_hash(hashed):
        return hashlib.sha256(plain.encode()).hexdigest() == hashed
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def password_needs_rehash(hashed: str | None) -> bool:
    if not hashed:
        return True
    if _is_legacy_hash(hashed):
        return True
    return pwd_context.needs_update(hashed)


def _store_token(user_id: str, token_type: str, ttl: int) -> str:
    token = generate_uuid()
    _token_store[token] = {"user_id": user_id, "expiry": time.time() + ttl, "type": token_type}
    return token


def issue_access_token(user_id: str) -> str:
    return _store_token(user_id, TOKEN_TYPE_ACCESS, ACCESS_TOKEN_TTL)


def issue_refresh_token(user_id: str) -> str:
    return _store_token(user_id, TOKEN_TYPE_REFRESH, REFRESH_TOKEN_TTL)


def issue_token_pair(user_id: str) -> tuple[str, str]:
    return issue_access_token(user_id), issue_refresh_token(user_id)


def revoke_token(token: str) -> None:
    _token_store.pop(token, None)


def revoke_user_tokens(user_id: str) -> None:
    for key, data in list(_token_store.items()):
        if data.get("user_id") == user_id:
            _token_store.pop(key, None)


def require_user_from_token(token: str, db: Session, expected_type: str):
    from .models import User

    data = _token_store.get(token)
    if not data or data.get("expiry", 0) < time.time():
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if data.get("type") != expected_type:
        raise HTTPException(status_code=403, detail="Invalid token type")
    user = db.query(User).filter_by(user_id=data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _cookie_params(ttl: int, http_only: bool = True) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "max_age": ttl,
        "httponly": http_only,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
    }
    if COOKIE_DOMAIN:
        params["domain"] = COOKIE_DOMAIN
    return params


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(ACCESS_COOKIE_NAME, access_token, **_cookie_params(ACCESS_TOKEN_TTL, http_only=True))
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_token, **_cookie_params(REFRESH_TOKEN_TTL, http_only=True))


def set_trap_cookie(response: Response) -> None:
    trap_token = generate_uuid()
    response.set_cookie(TRAP_COOKIE_NAME, trap_token, **_cookie_params(REFRESH_TOKEN_TTL, http_only=False))


def clear_auth_cookies(response: Response, *, keep_trap: bool = False) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    if not keep_trap:
        response.delete_cookie(TRAP_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    # Remove any legacy user_id cookie exposure
    response.delete_cookie("user_id", path="/", domain=COOKIE_DOMAIN)
    # Remove legacy cookie names that may remain in browsers
    response.delete_cookie("access_token", path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie("refresh_token", path="/", domain=COOKIE_DOMAIN)
