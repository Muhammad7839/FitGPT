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


DATABASE_URL = get_env("DATABASE_URL", "sqlite:///./fitgpt.db")
SECRET_KEY = get_env("SECRET_KEY", "dev-only-change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
GOOGLE_CLIENT_ID = get_env("GOOGLE_CLIENT_ID", "")
RESET_TOKEN_EXPIRE_MINUTES = int(get_env("RESET_TOKEN_EXPIRE_MINUTES", "30"))
OPENWEATHER_API_KEY = get_env("OPENWEATHER_API_KEY", "")
OPENWEATHER_TIMEOUT_SECONDS = float(get_env("OPENWEATHER_TIMEOUT_SECONDS", "5"))
