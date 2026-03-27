"""Authentication utilities: password hashing, JWT creation, and user resolution."""

from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database.database import get_db
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Validate a plaintext password against a stored hash."""
    return pwd_context.verify(plain_password, hashed_password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


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


oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/login", auto_error=False)


def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
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
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    """Resolve the authenticated user from the bearer token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

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
