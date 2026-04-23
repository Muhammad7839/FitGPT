"""Ensure the forgot-password rate-limit buckets drop stale keys."""

from app import routes as routes_module


def test_prune_drops_keys_whose_hits_are_all_outside_the_window() -> None:
    bucket: dict[str, list[float]] = {}

    # Record a hit for an old key at time=0, then fast-forward beyond the window.
    now = 1000.0
    routes_module._record_rate_limit_hit(bucket, "old@example.com", now)
    assert "old@example.com" in bucket

    future_now = now + routes_module.FORGOT_PASSWORD_WINDOW_SECONDS + 60.0
    routes_module._record_rate_limit_hit(bucket, "fresh@example.com", future_now)

    # Old key must be pruned on any subsequent write; only the fresh key remains.
    assert "old@example.com" not in bucket
    assert "fresh@example.com" in bucket


def test_prune_keeps_still_active_keys() -> None:
    bucket: dict[str, list[float]] = {}

    now = 1000.0
    routes_module._record_rate_limit_hit(bucket, "user1@example.com", now)
    routes_module._record_rate_limit_hit(bucket, "user2@example.com", now + 30.0)

    # Both keys are still within the window — prune must not drop either.
    assert "user1@example.com" in bucket
    assert "user2@example.com" in bucket


def test_record_returns_count_within_window_only() -> None:
    bucket: dict[str, list[float]] = {}

    now = 1000.0
    first = routes_module._record_rate_limit_hit(bucket, "user@example.com", now)
    second = routes_module._record_rate_limit_hit(bucket, "user@example.com", now + 5)
    assert first == 1
    assert second == 2

    # After the full window has elapsed *past the last hit*, old hits drop
    # out of the count — only the newest hit counts.
    after_window = now + 5 + routes_module.FORGOT_PASSWORD_WINDOW_SECONDS + 1
    third = routes_module._record_rate_limit_hit(bucket, "user@example.com", after_window)
    assert third == 1
