"""Centralized runtime configuration for backend environment variables."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
_ENV_LOADED = False


def load_environment() -> None:
    global _ENV_LOADED
    env_path = BACKEND_ROOT / ".env"
    if not _ENV_LOADED:
        load_dotenv(dotenv_path=env_path, override=False)
        _ENV_LOADED = True


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


def _default_sqlite_url(file_name: str) -> str:
    return f"sqlite:///{(BACKEND_ROOT / file_name).resolve()}"


DATABASE_URL = get_env("DATABASE_URL", _default_sqlite_url("fitgpt.db"))
SECRET_KEY = get_env("SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = get_int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
GOOGLE_CLIENT_ID = get_env("GOOGLE_CLIENT_ID", "")
RESET_TOKEN_EXPIRE_MINUTES = get_int_env("RESET_TOKEN_EXPIRE_MINUTES", 30)
EXPOSE_RESET_TOKEN_IN_RESPONSE = get_bool_env("EXPOSE_RESET_TOKEN_IN_RESPONSE", False)
OPENWEATHER_API_KEY = get_env("OPENWEATHER_API_KEY", "")
OPENWEATHER_TIMEOUT_SECONDS = get_float_env("OPENWEATHER_TIMEOUT_SECONDS", 5)
MAX_UPLOAD_IMAGE_BYTES = get_int_env("MAX_UPLOAD_IMAGE_BYTES", 5 * 1024 * 1024)
GROQ_API_KEY = get_env("GROQ_API_KEY", "")
GROQ_MODEL = get_env("GROQ_MODEL", "llama-3.3-70b-versatile")
AI_TIMEOUT_SECONDS = get_float_env("AI_TIMEOUT_SECONDS", 12)
AI_MAX_TOKENS = get_int_env("AI_MAX_TOKENS", 450)
AI_TEMPERATURE = get_float_env("AI_TEMPERATURE", 0.4)

ENVIRONMENT = get_env("ENVIRONMENT", "development").strip().lower()
if ENVIRONMENT in {"prod", "production"} and SECRET_KEY == "dev-only-change-me":
    raise RuntimeError("SECRET_KEY must be set in production")


def log_optional_config_warnings(logger: logging.Logger) -> None:
    if not OPENWEATHER_API_KEY:
        logger.warning("OPENWEATHER_API_KEY missing — using fallback weather mode")
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY missing — using fallback AURA mode")
    if not GOOGLE_CLIENT_ID:
        logger.warning("GOOGLE_CLIENT_ID missing — Google sign-in token verification is disabled")
