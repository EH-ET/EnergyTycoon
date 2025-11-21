from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .auth_utils import TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH, require_user_from_token
from .database import get_db
from .models import User


def _extract_auth_token(header_val: Optional[str], cookie_val: Optional[str]) -> str:
    if header_val and header_val.lower().startswith("bearer "):
        return header_val.split(" ", 1)[1].strip()
    if header_val:
        return header_val
    if cookie_val:
        return cookie_val
    raise HTTPException(status_code=401, detail="Authorization token missing")


def get_token_from_header(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None, alias="ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88"),
) -> str:
    return _extract_auth_token(authorization, access_token)


def get_user_and_db(token: str = Depends(get_token_from_header), db: Session = Depends(get_db)):
    user = require_user_from_token(token, db, expected_type=TOKEN_TYPE_ACCESS)
    return user, db, token


def get_refresh_token(
    authorization: Optional[str] = Header(None),
    refresh_token: Optional[str] = Cookie(None, alias="yeCuXMndsYC3kMnAPw__"),
) -> str:
    return _extract_auth_token(authorization, refresh_token)


def get_refresh_user_and_db(token: str = Depends(get_refresh_token), db: Session = Depends(get_db)):
    user = require_user_from_token(token, db, expected_type=TOKEN_TYPE_REFRESH)
    return user, db, token
