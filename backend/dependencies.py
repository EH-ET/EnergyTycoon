from typing import Optional

from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from .auth_utils import TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH, require_user_from_token
from .database import get_db
from .models import User


def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return authorization


def get_user_and_db(token: str = Depends(get_token_from_header), db: Session = Depends(get_db)):
    user = require_user_from_token(token, db, expected_type=TOKEN_TYPE_ACCESS)
    return user, db, token


def get_refresh_user_and_db(token: str = Depends(get_token_from_header), db: Session = Depends(get_db)):
    user = require_user_from_token(token, db, expected_type=TOKEN_TYPE_REFRESH)
    return user, db, token
