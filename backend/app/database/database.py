"""SQLAlchemy engine and session management for the FitGPT backend."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

_db_url = DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = "postgresql://" + _db_url[len("postgres://"):]

connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
engine = create_engine(_db_url, connect_args=connect_args)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db() -> Generator:
    """Yield a DB session for a single request lifecycle."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
