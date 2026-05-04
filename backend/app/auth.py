"""Authentication utilities: password hashing, JWT creation, and user resolution."""

# JWTs use HS256 with SECRET_KEY from env (see config.py). RS256 + asymmetric keys are
# preferable for multi-service production setups; refresh tokens are stateless JWTs (no
# server-side session table), so rotation relies on issuing new refresh tokens on /auth/refresh.

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app import models
from app.config import SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS

BCRYPT_COST = 12
from app.database.database import get_db


def _normalize_bcrypt_hash(hashed_password: str) -> bytes:
    normalized = hashed_password.strip()
    if normalized.startswith("$2y$"):
        normalized = normalized.replace("$2y$", "$2b$", 1)
    return normalized.encode("utf-8")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    password_bytes = password.encode("utf-8")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=BCRYPT_COST)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Validate a plaintext password against a stored hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            _normalize_bcrypt_hash(hashed_password),
        )
    except ValueError:
        return False


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _extract_bearer_token(authorization: str) -> Optional[str]:
    value = authorization.strip()
    if not value:
        return None

    parts = value.split(" ", 1)
    if len(parts) != 2:
        return None

    scheme, token = parts[0].strip(), parts[1].strip()
    if scheme.lower() != "bearer" or not token:
        return None

    return token


def get_bearer_token(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> str:
    token = _extract_bearer_token(authorization or "")
    if not token:
        raise _credentials_exception()
    return token


def get_optional_bearer_token(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> Optional[str]:
    return _extract_bearer_token(authorization or "")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token for API authentication."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a signed JWT refresh token for issuing new access tokens."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode a signed JWT or raise a 401 credentials error."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except InvalidTokenError:
        raise _credentials_exception()


def get_optional_user(
    token: Optional[str] = Depends(get_optional_bearer_token),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """Resolve the authenticated user if a valid token is present, otherwise return None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user_id = int(user_id)
    except (InvalidTokenError, ValueError, TypeError):
        return None
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db)
) -> models.User:
    """Resolve the authenticated user from the bearer token."""
    credentials_exception = _credentials_exception()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        user_id = int(user_id)

    except (InvalidTokenError, ValueError, TypeError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if user is None:
        raise credentials_exception

    return user
