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
_frontend_origins_env = os.getenv("FRONTEND_ORIGINS", "")
_cookie_secure_env = os.getenv("COOKIE_SECURE")
_cookie_samesite_env = os.getenv("COOKIE_SAMESITE")


def _is_cross_site_default(origins: str) -> bool:
    """
    기본값을 추정할 때 https 기반 프론트(예: Netlify)에서 접근하는지 판단.
    """
    lower = (origins or "").lower()
    return "https://" in lower or "netlify.app" in lower


if _cookie_secure_env is None and _is_cross_site_default(_frontend_origins_env):
    COOKIE_SECURE = True
else:
    COOKIE_SECURE = (_cookie_secure_env or "false").lower() == "true"

if _cookie_samesite_env is None and _is_cross_site_default(_frontend_origins_env):
    COOKIE_SAMESITE = "none"
else:
    COOKIE_SAMESITE = (_cookie_samesite_env or "lax").lower()
# Default JWT secret (override with JWT_SECRET/SECRET_KEY env vars in production)
DEFAULT_JWT_SECRET = "8ecc6d679526d53054fa5ddbba41b2c1dc050c10c360312f255c4de979ce8699a019694ac648aa91b02049a538779a088f9e3327db6020d9e2d66ecd6e7c9b61f54fcc1178417c87ac74bb83d488e3fdedd1973f584737ff4125748d93ead864fc06d95880eabfc5e13317a878496156cfc2e73e982d5573c3cdcf927e5d9721fd7c86e4ae107ddcbf4b7deb6465cdc8040a7deb75c7be2602c06bbea150871abc89ee396cffb5bed5344d2c4665bc406f87517c293bf3a97b79a2861faf9c90889d45020bad9143787a0c9064d4734cafce6d6be99af849845e8688272f383272efd567bee33f7f1983443818e95aa64077c327a492fed38354e35abde5a412bf7dbac410f9db90cfef07491141c2c29ff7e214e368e577c4bb0f663733ce52975eea73cae2cab24674bc9c718ac3b85ce95dc5024c2673819a025fdf056bdafad32b15d79b268854c222578da91cda0034cb544435a3d26a9494d92ba432f1c7988e9566a597f0390d1b10725da535c911f76e9a5d59125c5ac723e0e605efcbba94d7b66e6380373f08f06f7fee463ae5aff7c8ce009179d5aac368dbf5be023bafb39df76335e0e94e12233dad0e29b397dfb4303fbac2568f5cdb498cf3493c9bf62283588c8d158b1147cdd5d1eaa471de8d5a0907b855a5a568b79faafcbc9829fef6239dfcd303c18cf9e26e8d0a124da3efc4fbb4debc9a31a4cbc8"
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", DEFAULT_JWT_SECRET))
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
    response.headers[CSRF_HEADER_NAME] = token
    existing_expose = response.headers.get("Access-Control-Expose-Headers")
    if existing_expose:
        exposed = {h.strip() for h in existing_expose.split(",") if h.strip()}
        exposed.add(CSRF_HEADER_NAME)
        response.headers["Access-Control-Expose-Headers"] = ", ".join(sorted(exposed))
    else:
        response.headers["Access-Control-Expose-Headers"] = CSRF_HEADER_NAME
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
