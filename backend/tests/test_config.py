from pathlib import Path

from app.config import _normalize_database_url


def test_normalize_database_url_anchors_relative_sqlite_paths():
    normalized = _normalize_database_url("sqlite:///./fitgpt.db")

    backend_dir = Path(__file__).resolve().parents[1]
    expected_path = (backend_dir / "./fitgpt.db").resolve().as_posix()
    assert normalized == f"sqlite:///{expected_path}"


def test_normalize_database_url_keeps_absolute_and_memory_sqlite_paths():
    assert _normalize_database_url("sqlite:///:memory:") == "sqlite:///:memory:"
    assert _normalize_database_url("sqlite:////tmp/fitgpt.db") == "sqlite:////tmp/fitgpt.db"


def test_normalize_database_url_keeps_non_sqlite_url():
    postgres_url = "postgresql+psycopg://user:secret@localhost:5432/fitgpt"
    assert _normalize_database_url(postgres_url) == postgres_url
