"""Centralized runtime configuration for backend environment variables."""

import os
from pathlib import Path


def _load_local_env_file() -> None:
    """Load key=value pairs from backend/.env into process env if missing."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env_file()


def get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value


def get_int_env(name: str, default: int) -> int:
    raw_value = get_env(name, str(default))
    try:
        return int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer, got '{raw_value}'") from exc


def get_float_env(name: str, default: float) -> float:
    raw_value = get_env(name, str(default))
    try:
        return float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a float, got '{raw_value}'") from exc


def get_bool_env(name: str, default: bool) -> bool:
    raw_value = get_env(name, "true" if default else "false").strip().lower()
    if raw_value in {"1", "true", "yes", "on"}:
        return True
    if raw_value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean, got '{raw_value}'")


DATABASE_URL = get_env("DATABASE_URL", "sqlite:///./fitgpt.db")
SECRET_KEY = get_env("SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = get_int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
GOOGLE_CLIENT_ID = get_env("GOOGLE_CLIENT_ID", "")
RESET_TOKEN_EXPIRE_MINUTES = get_int_env("RESET_TOKEN_EXPIRE_MINUTES", 30)
EXPOSE_RESET_TOKEN_IN_RESPONSE = get_bool_env("EXPOSE_RESET_TOKEN_IN_RESPONSE", False)
OPENWEATHER_API_KEY = get_env("OPENWEATHER_API_KEY", "")
OPENWEATHER_TIMEOUT_SECONDS = get_float_env("OPENWEATHER_TIMEOUT_SECONDS", 5)
MAX_UPLOAD_IMAGE_BYTES = get_int_env("MAX_UPLOAD_IMAGE_BYTES", 5 * 1024 * 1024)

ENVIRONMENT = get_env("ENVIRONMENT", "development").strip().lower()
if ENVIRONMENT in {"prod", "production"} and SECRET_KEY == "dev-only-change-me":
    raise RuntimeError("SECRET_KEY must be set in production")
