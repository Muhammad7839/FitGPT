"""Ensure DB-backed rate-limit events are counted and pruned."""

from datetime import datetime, timedelta

from app import models
from app import routes as routes_module
from conftest import TestingSessionLocal


def _db_count() -> int:
    db = TestingSessionLocal()
    try:
        return db.query(models.RateLimitEvent).count()
    finally:
        db.close()


def test_prune_drops_rows_older_than_one_hour() -> None:
    db = TestingSessionLocal()
    try:
        now = datetime(2026, 1, 1, 12, 0, 0)
        routes_module._record_rate_limit_hit(
            db,
            "old@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            now,
        )

        future_now = now + timedelta(seconds=routes_module.RATE_LIMIT_PRUNE_SECONDS + 60)
        routes_module._record_rate_limit_hit(
            db,
            "fresh@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            future_now,
        )

        rows = db.query(models.RateLimitEvent).all()
        assert [row.key for row in rows] == ["fresh@example.com"]
    finally:
        db.close()


def test_prune_keeps_still_active_rows() -> None:
    db = TestingSessionLocal()
    try:
        now = datetime(2026, 1, 1, 12, 0, 0)
        routes_module._record_rate_limit_hit(
            db,
            "user1@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            now,
        )
        routes_module._record_rate_limit_hit(
            db,
            "user2@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            now + timedelta(seconds=30),
        )

        assert _db_count() == 2
    finally:
        db.close()


def test_record_returns_count_within_window_only() -> None:
    db = TestingSessionLocal()
    try:
        now = datetime(2026, 1, 1, 12, 0, 0)
        first = routes_module._record_rate_limit_hit(
            db,
            "user@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            now,
        )
        second = routes_module._record_rate_limit_hit(
            db,
            "user@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            now + timedelta(seconds=5),
        )
        assert first == 1
        assert second == 2

        after_window = now + timedelta(seconds=routes_module.FORGOT_PASSWORD_WINDOW_SECONDS + 6)
        third = routes_module._record_rate_limit_hit(
            db,
            "user@example.com",
            "forgot_password_email",
            routes_module.FORGOT_PASSWORD_WINDOW_SECONDS,
            after_window,
        )
        assert third == 1
    finally:
        db.close()
