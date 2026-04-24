"""Shared backend test fixtures and DB overrides for integration tests."""

import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on PYTHONPATH when running pytest from any directory.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/fitgpt_test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.database.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app import routes as routes_module  # noqa: E402


TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "sqlite:////tmp/fitgpt_test.db")
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_db():
    """Reset database schema for each test for full isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    routes_module._reset_forgot_password_throttle_state()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Return a TestClient bound to the app with DB overrides applied."""
    return TestClient(app)


def register_and_login(client: TestClient, email: str, password: str) -> str:
    """Create a user and return its access token."""
    register = client.post("/register", json={"email": email, "password": password})
    assert register.status_code == 200

    login = client.post(
        "/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]
