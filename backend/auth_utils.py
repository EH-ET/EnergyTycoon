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
ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME", "ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88").strip()
# Cookie names cannot contain "=", so we default to an obfuscated, cookie-safe variant.
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "yeCuXMndsYC3kMnAPw__").strip()
TRAP_COOKIE_NAME = os.getenv("TRAP_COOKIE_NAME", "abtkn").strip()
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "csrf_token").strip()
CSRF_HEADER_NAME = os.getenv("CSRF_HEADER_NAME", "x-csrf-token").strip()
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
if COOKIE_DOMAIN:
    COOKIE_DOMAIN = COOKIE_DOMAIN.strip()
    # Force None for proxy compatibility (Netlify -> Render)
    if not COOKIE_DOMAIN:
        COOKIE_DOMAIN = None
# Always use None to let browser set cookie for current origin
COOKIE_DOMAIN = None
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
    # For cross-site requests (e.g., Netlify -> Render), SameSite must be 'None' to send cookies.
    COOKIE_SAMESITE = "none"
else:
    COOKIE_SAMESITE = (_cookie_samesite_env or "lax").lower()
# Default JWT secret (override with JWT_SECRET/SECRET_KEY env vars in production)
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "NULL"))

# Security check: warn if using default secret
if JWT_SECRET == "NULL":
    import warnings
    warnings.warn(
        "Using default JWT_SECRET! This is insecure for production. "
        "Set JWT_SECRET or SECRET_KEY environment variable.",
        RuntimeWarning,
        stacklevel=2
    )

JWT_ALG = "HS256"

_LEGACY_HASH_LENGTH = 64
_HEX_DIGITS = set(string.hexdigits.lower())

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)

# Refresh 토큰 회전을 위한 간단 화이트리스트 (프로세스 메모리 상)
# In-memory whitelist is replaced by user.refresh_jti in the database
# to support multiple server instances.


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


def issue_refresh_token(user: "User", db: Session) -> str:
    from .models import User
    jti = generate_uuid()
    user.refresh_jti = jti
    db.add(user)
    db.commit()
    db.refresh(user)
    payload = {
        "sub": user.user_id,
        "typ": TOKEN_TYPE_REFRESH,
        "jti": jti,
    }
    return _encode_token(payload, REFRESH_TOKEN_TTL)


def issue_token_pair(user: "User", db: Session) -> tuple[str, str]:
    from .models import User
    return issue_access_token(user.user_id), issue_refresh_token(user, db)


def revoke_token(token: str, db: Session) -> None:
    from .models import User
    try:
        # Verify signature but not expiration, as we might need to revoke an expired token
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], options={"verify_exp": False})
    except jwt.PyJWTError:
        return  # Invalid token, nothing to do

    if decoded.get("typ") == TOKEN_TYPE_REFRESH:
        user_id = decoded.get("sub")
        if not user_id:
            return
        user = db.query(User).filter_by(user_id=user_id).first()
        # Only revoke if the JTI matches the one in the DB
        if user and user.refresh_jti and user.refresh_jti == decoded.get("jti"):
            user.refresh_jti = None
            db.add(user)
            db.commit()


def revoke_user_tokens(user_id: str, db: Session) -> None:
    from .models import User
    user = db.query(User).filter_by(user_id=user_id).first()
    if user:
        user.refresh_jti = None
        db.add(user)
        db.commit()


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

    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        # Even if the token is valid, if the user doesn't exist, it's an auth error.
        raise HTTPException(status_code=401, detail="User not found for token")

    if expected_type == TOKEN_TYPE_REFRESH:
        jti = data.get("jti")
        if not jti or not user.refresh_jti or user.refresh_jti != jti:
            raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")

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
