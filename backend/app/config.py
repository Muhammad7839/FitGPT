"""Centralized runtime configuration for backend environment variables."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
_OPTIONAL_CONFIG_WARNINGS_LOGGED = False
_ENV_LOADED = False


def load_environment() -> Path:
    """Load backend/.env into process env once without overriding exported values."""
    global _ENV_LOADED
    env_path = BACKEND_ROOT / ".env"
    if not _ENV_LOADED:
        load_dotenv(dotenv_path=env_path, override=False)
        _ENV_LOADED = True
    return env_path


load_environment()


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


def get_list_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return list(default)
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def resolve_google_client_id() -> str:
    return get_env("GOOGLE_CLIENT_ID", get_env("GOOGLE_WEB_CLIENT_ID", ""))


def _default_sqlite_url(file_name: str) -> str:
    return f"sqlite:///{(BACKEND_ROOT / file_name).resolve()}"


def _normalize_database_url(raw: str) -> str:
    """Resolve relative sqlite:/// paths to absolute so the DB file is always
    created in the backend directory regardless of the working directory."""
    normalized = raw.strip()
    prefix = "sqlite:///"
    if not normalized.startswith(prefix):
        return normalized
    sqlite_path = normalized[len(prefix):]
    if not sqlite_path or sqlite_path == ":memory:" or sqlite_path.startswith("/"):
        return normalized
    absolute = (BACKEND_ROOT / sqlite_path).resolve()
    return f"{prefix}{absolute.as_posix()}"


DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://fit-gpt-i3co.vercel.app",
    "https://fitgpt.tech",
    "https://www.fitgpt.tech",
]

FORCE_LOCAL_DATABASE = get_bool_env("FITGPT_LOCAL_BACKEND", False)
DATABASE_URL = (
    _default_sqlite_url("fitgpt.db")
    if FORCE_LOCAL_DATABASE
    else _normalize_database_url(get_env("DATABASE_URL", _default_sqlite_url("fitgpt.db")))
)
SECRET_KEY = get_env("SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = get_int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
REFRESH_TOKEN_EXPIRE_DAYS = get_int_env("REFRESH_TOKEN_EXPIRE_DAYS", 30)
GOOGLE_CLIENT_ID = resolve_google_client_id()
RESET_TOKEN_EXPIRE_MINUTES = get_int_env("RESET_TOKEN_EXPIRE_MINUTES", 30)
ENVIRONMENT = get_env("ENVIRONMENT", "development").strip().lower()
EXPOSE_RESET_TOKEN_IN_RESPONSE = get_bool_env(
    "EXPOSE_RESET_TOKEN_IN_RESPONSE",
    ENVIRONMENT not in {"prod", "production"},
)
CORS_ORIGINS = get_list_env("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
OPENWEATHER_API_KEY = get_env("OPENWEATHER_API_KEY", "")
OPENWEATHER_TIMEOUT_SECONDS = get_float_env("OPENWEATHER_TIMEOUT_SECONDS", 5)
OPENWEATHER_FORECAST_CACHE_SECONDS = get_int_env("OPENWEATHER_FORECAST_CACHE_SECONDS", 900)
MAX_UPLOAD_IMAGE_BYTES = get_int_env("MAX_UPLOAD_IMAGE_BYTES", 5 * 1024 * 1024)
STORAGE_BACKEND = get_env("STORAGE_BACKEND", "local").strip().lower()
S3_BUCKET = get_env("S3_BUCKET", "")
S3_ENDPOINT_URL = get_env("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY_ID = get_env("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = get_env("S3_SECRET_ACCESS_KEY", "")
S3_PUBLIC_BASE_URL = get_env("S3_PUBLIC_BASE_URL", "")
GROQ_API_KEY = get_env("GROQ_API_KEY", "")
GROQ_MODEL = get_env("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = get_env("GROQ_VISION_MODEL", "")
AI_TIMEOUT_SECONDS = get_float_env("AI_TIMEOUT_SECONDS", 12)
AI_MAX_TOKENS = get_int_env("AI_MAX_TOKENS", 600)
AI_TEMPERATURE = get_float_env("AI_TEMPERATURE", 0.72)
SENTRY_DSN = get_env("SENTRY_DSN", "")

if ENVIRONMENT in {"prod", "production"} and SECRET_KEY == "dev-only-change-me":
    raise RuntimeError("SECRET_KEY must be set in production")


def collect_optional_config_warnings() -> list[str]:
    warnings: list[str] = []
    if not OPENWEATHER_API_KEY:
        warnings.append("OPENWEATHER_API_KEY missing — using fallback weather mode")
    if not GROQ_API_KEY:
        warnings.append("GROQ_API_KEY missing — using fallback AURA mode")
    if not GOOGLE_CLIENT_ID:
        warnings.append("GOOGLE_CLIENT_ID missing — Google sign-in token verification is disabled")
    return warnings


def log_optional_config_warnings(logger: logging.Logger) -> None:
    global _OPTIONAL_CONFIG_WARNINGS_LOGGED
    if _OPTIONAL_CONFIG_WARNINGS_LOGGED:
        return
    for warning in collect_optional_config_warnings():
        logger.warning(warning)
    _OPTIONAL_CONFIG_WARNINGS_LOGGED = True
