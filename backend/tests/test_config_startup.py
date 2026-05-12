"""Runtime config warning coverage for optional integrations."""

import pytest

from app import config


def test_collect_optional_config_warnings_reports_missing_integrations(monkeypatch):
    monkeypatch.setattr(config, "OPENWEATHER_API_KEY", "")
    monkeypatch.setattr(config, "GROQ_API_KEY", "")
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "")

    warnings = config.collect_optional_config_warnings()

    assert "OPENWEATHER_API_KEY missing — using fallback weather mode" in warnings
    assert "GROQ_API_KEY missing — using fallback AURA mode" in warnings
    assert "GOOGLE_CLIENT_ID missing — Google sign-in token verification is disabled" in warnings


def test_collect_optional_config_warnings_returns_empty_when_integrations_present(monkeypatch):
    monkeypatch.setattr(config, "OPENWEATHER_API_KEY", "weather-key")
    monkeypatch.setattr(config, "GROQ_API_KEY", "groq-key")
    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "client-id")

    assert config.collect_optional_config_warnings() == []


def test_resolve_google_client_id_falls_back_to_google_web_client_id(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.setenv("GOOGLE_WEB_CLIENT_ID", "web-client-id")

    assert config.resolve_google_client_id() == "web-client-id"


def test_get_list_env_parses_cors_origins(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        " https://preview.fitgpt.tech , http://192.168.1.50:3000 , "
    )

    assert config.get_list_env("CORS_ORIGINS", config.DEFAULT_CORS_ORIGINS) == [
        "https://preview.fitgpt.tech",
        "http://192.168.1.50:3000",
    ]


def test_validate_runtime_configuration_requires_database_url_in_production(monkeypatch):
    monkeypatch.setattr(config, "ENVIRONMENT", "production")
    monkeypatch.setattr(config, "_DATABASE_URL_FROM_ENV", "")
    monkeypatch.setattr(config, "DATABASE_URL", "sqlite:////tmp/fitgpt.db")
    monkeypatch.setattr(config, "SECRET_KEY", "secure-secret")

    with pytest.raises(RuntimeError, match="DATABASE_URL must be set in production"):
        config.validate_runtime_configuration()


def test_validate_runtime_configuration_rejects_sqlite_in_production(monkeypatch):
    monkeypatch.setattr(config, "ENVIRONMENT", "production")
    monkeypatch.setattr(config, "_DATABASE_URL_FROM_ENV", "sqlite:////tmp/fitgpt.db")
    monkeypatch.setattr(config, "DATABASE_URL", "sqlite:////tmp/fitgpt.db")
    monkeypatch.setattr(config, "SECRET_KEY", "secure-secret")
    monkeypatch.delenv("ALLOW_SQLITE_IN_PRODUCTION", raising=False)

    with pytest.raises(RuntimeError, match="SQLite is not allowed in production"):
        config.validate_runtime_configuration()


def test_validate_runtime_configuration_allows_sqlite_when_explicitly_overridden(monkeypatch):
    monkeypatch.setattr(config, "ENVIRONMENT", "production")
    monkeypatch.setattr(config, "_DATABASE_URL_FROM_ENV", "sqlite:////tmp/fitgpt.db")
    monkeypatch.setattr(config, "DATABASE_URL", "sqlite:////tmp/fitgpt.db")
    monkeypatch.setattr(config, "SECRET_KEY", "secure-secret")
    monkeypatch.setenv("ALLOW_SQLITE_IN_PRODUCTION", "true")

    config.validate_runtime_configuration()
