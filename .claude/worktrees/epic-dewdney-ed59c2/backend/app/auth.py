"""Authentication utilities: password hashing, JWT creation, and user resolution."""

import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.config import SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database.database import get_db


def _normalize_bcrypt_hash(hashed_password: str) -> bytes:
    normalized = hashed_password.strip()
    if normalized.startswith("$2y$"):
        normalized = normalized.replace("$2y$", "$2b$", 1)
    return normalized.encode("utf-8")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    password_bytes = password.encode("utf-8")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


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
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


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
    except (JWTError, ValueError, TypeError):
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

    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if user is None:
        raise credentials_exception

    return user
