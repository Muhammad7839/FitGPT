"""Centralized application configuration loaded from environment variables."""

import os


def get_env(name: str, default: str) -> str:
    """Read a non-empty environment variable, otherwise return the default."""
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value


DATABASE_URL = get_env("DATABASE_URL", "sqlite:///./fitgpt.db")
SECRET_KEY = get_env("SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
GOOGLE_CLIENT_ID = get_env("GOOGLE_CLIENT_ID", "")
