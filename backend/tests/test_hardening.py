"""Targeted hardening coverage for auth throttling, prompt sanitation, and health checks."""

import pytest

import app.main as main_module
import app.routes as routes_module
from app.ai.prompts import _safe_text
from app.google_oauth import GoogleTokenValidationError, verify_google_id_token
from app.weather import WeatherLookupError
from conftest import register_and_login


def test_health_reports_database_ready(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
    }


def test_health_returns_503_when_database_probe_fails(client, monkeypatch):
    def failing_connect():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(main_module.engine, "connect", failing_connect)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "degraded",
        "database": "unavailable",
    }


def test_wardrobe_create_returns_serializable_422_for_blank_required_text(client):
    token = register_and_login(client, "wardrobe-hardening@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Broken item",
        "category": "   ",
        "color": "Black",
        "season": "All",
        "comfort_level": 3,
    }

    response = client.post("/wardrobe/items", json=payload, headers=auth)

    assert response.status_code == 422
    body = response.json()
    assert body["detail"][0]["loc"] == ["category"]
    assert "value cannot be blank" in body["detail"][0]["msg"].lower()
    assert "ctx" not in body["detail"][0]


def test_wardrobe_create_returns_422_for_oversized_style_tag_list(client):
    token = register_and_login(client, "wardrobe-tags@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Tag-heavy item",
        "category": "Top",
        "color": "Black",
        "season": "All",
        "comfort_level": 3,
        "style_tags": [f"tag-{index}" for index in range(13)],
    }

    response = client.post("/wardrobe/items", json=payload, headers=auth)

    assert response.status_code == 422
    body = response.json()
    assert body["detail"][0]["loc"] == ["style_tags"]


def test_wardrobe_create_returns_serializable_422_for_oversized_tag_element(client):
    token = register_and_login(client, "wardrobe-long-tag@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Long-tag item",
        "category": "Top",
        "color": "Black",
        "season": "All",
        "comfort_level": 3,
        "style_tags": ["x" * 100],
    }

    response = client.post("/wardrobe/items", json=payload, headers=auth)

    assert response.status_code == 422
    body = response.json()
    assert body["detail"][0]["loc"] == ["style_tags"]
    assert "64 characters or fewer" in body["detail"][0]["msg"]
    assert "ctx" not in body["detail"][0]


def test_forgot_password_is_rate_limited_per_email(client, monkeypatch):
    monkeypatch.setattr(routes_module, "EXPOSE_RESET_TOKEN_IN_RESPONSE", False)
    register_and_login(client, "rate-limit@example.com", "Testpass9x")

    for _ in range(routes_module.FORGOT_PASSWORD_EMAIL_LIMIT):
        response = client.post("/forgot-password", json={"email": "rate-limit@example.com"})
        assert response.status_code == 200

    blocked = client.post("/forgot-password", json={"email": "rate-limit@example.com"})

    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many password reset requests. Please try again later."


def test_auth_forgot_password_alias_is_rate_limited_per_ip(client):
    ip_headers = {"x-forwarded-for": "203.0.113.99"}

    for index in range(routes_module.FORGOT_PASSWORD_IP_LIMIT):
        response = client.post(
            "/auth/forgot-password",
            json={"email": f"ip-limit-{index}@example.com"},
            headers=ip_headers,
        )
        assert response.status_code == 200

    blocked = client.post(
        "/auth/forgot-password",
        json={"email": "ip-limit-overflow@example.com"},
        headers=ip_headers,
    )

    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many password reset requests. Please try again later."


def test_safe_text_collapses_whitespace_and_caps_length():
    source = "  line one\r\nline two\tline three  " + ("x" * 200)

    result = _safe_text(source)

    assert "\n" not in result
    assert "\r" not in result
    assert "\t" not in result
    assert result.startswith("line one line two line three")
    assert len(result) == 120


def test_safe_text_returns_fallback_for_empty_values():
    assert _safe_text(None) == "unspecified"
    assert _safe_text("   ") == "unspecified"
    assert _safe_text("", fallback="everyday") == "everyday"


def test_verify_google_id_token_requires_config(monkeypatch):
    monkeypatch.setattr("app.google_oauth.GOOGLE_CLIENT_ID", "")

    with pytest.raises(GoogleTokenValidationError, match="Google OAuth is not configured"):
        verify_google_id_token("fake-token")


def test_verify_google_id_token_rejects_missing_email(monkeypatch):
    monkeypatch.setattr("app.google_oauth.GOOGLE_CLIENT_ID", "expected-client-id")
    monkeypatch.setattr(
        "app.google_oauth.id_token.verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "aud": "expected-client-id",
            "iss": "https://accounts.google.com",
            "email_verified": True,
        },
    )

    with pytest.raises(GoogleTokenValidationError, match="Google token is missing email"):
        verify_google_id_token("fake-token")


def test_verify_google_id_token_rejects_unverified_email(monkeypatch):
    monkeypatch.setattr("app.google_oauth.GOOGLE_CLIENT_ID", "expected-client-id")
    monkeypatch.setattr(
        "app.google_oauth.id_token.verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "aud": "expected-client-id",
            "iss": "https://accounts.google.com",
            "email": "user@example.com",
            "email_verified": False,
        },
    )

    with pytest.raises(GoogleTokenValidationError, match="Google email is not verified"):
        verify_google_id_token("fake-token")


def test_weather_forecast_returns_provider_status_and_message(client, monkeypatch):
    token = register_and_login(client, "forecast-hardening@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    def raise_lookup_error(**_kwargs):
        raise WeatherLookupError("Forecast provider unavailable", status_code=503)

    monkeypatch.setattr("app.routes.fetch_daily_forecast", raise_lookup_error)

    response = client.get("/weather/forecast", headers=auth, params={"city": "Boston"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Forecast provider unavailable"
