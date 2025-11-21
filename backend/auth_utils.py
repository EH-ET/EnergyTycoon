import hashlib
import os
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
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
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "csrf_token")
CSRF_HEADER_NAME = os.getenv("CSRF_HEADER_NAME", "x-csrf-token")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "change-me"))
JWT_ALG = "HS256"

_LEGACY_HASH_LENGTH = 64
_HEX_DIGITS = set(string.hexdigits.lower())

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)

# Refresh 토큰 회전을 위한 간단 화이트리스트 (프로세스 메모리 상)
_refresh_whitelist: Dict[str, str] = {}


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


def _encode_token(payload: Dict[str, Any], ttl: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    payload = {**payload, "exp": exp, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def issue_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "typ": TOKEN_TYPE_ACCESS,
        "jti": generate_uuid(),
    }
    return _encode_token(payload, ACCESS_TOKEN_TTL)


def issue_refresh_token(user_id: str) -> str:
    jti = generate_uuid()
    _refresh_whitelist[user_id] = jti
    payload = {
        "sub": user_id,
        "typ": TOKEN_TYPE_REFRESH,
        "jti": jti,
    }
    return _encode_token(payload, REFRESH_TOKEN_TTL)


def issue_token_pair(user_id: str) -> tuple[str, str]:
    return issue_access_token(user_id), issue_refresh_token(user_id)


def revoke_token(token: str) -> None:
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return
        # If the token is invalid, there's nothing to revoke
    if decoded.get("typ") == TOKEN_TYPE_REFRESH:
        user_id = decoded.get("sub")
        jti = decoded.get("jti")
        if user_id and _refresh_whitelist.get(user_id) == jti:
            _refresh_whitelist.pop(user_id, None)


def revoke_user_tokens(user_id: str) -> None:
    _refresh_whitelist.pop(user_id, None)


def require_user_from_token(token: str, db: Session, expected_type: str):
    from .models import User

    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if data.get("typ") != expected_type:
        raise HTTPException(status_code=403, detail="Invalid token type")

    user_id = data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    if expected_type == TOKEN_TYPE_REFRESH:
        jti = data.get("jti")
        if not jti or _refresh_whitelist.get(user_id) != jti:
            raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")
    user = db.query(User).filter_by(user_id=user_id).first()
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


def set_csrf_cookie(response: Response) -> str:
    token = generate_uuid()
    response.set_cookie(CSRF_COOKIE_NAME, token, **_cookie_params(REFRESH_TOKEN_TTL, http_only=False))
    return token


def clear_auth_cookies(response: Response, *, keep_trap: bool = False) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(CSRF_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    if not keep_trap:
        response.delete_cookie(TRAP_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    # Remove any legacy user_id cookie exposure
    response.delete_cookie("user_id", path="/", domain=COOKIE_DOMAIN)
    # Remove legacy cookie names that may remain in browsers
    response.delete_cookie("access_token", path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie("refresh_token", path="/", domain=COOKIE_DOMAIN)
