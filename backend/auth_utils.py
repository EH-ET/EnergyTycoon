import hashlib
import os
import string
import time
import uuid
from typing import Any, Dict

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy.orm import Session


ACCESS_TOKEN_TTL = int(os.getenv("ACCESS_TOKEN_TTL", 3600))
REFRESH_TOKEN_TTL = int(os.getenv("REFRESH_TOKEN_TTL", 86400 * 7))
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
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
