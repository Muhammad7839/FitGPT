"""Weather hardening tests for provider payload failures and numeric parsing fallbacks."""

import time

from app import weather
from conftest import register_and_login


def test_weather_current_returns_controlled_error_when_provider_json_is_invalid(client, monkeypatch):
    token = register_and_login(client, "weather-json-invalid@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    class FakeResponse:
        status_code = 200
        ok = True

        def json(self):
            raise ValueError("malformed json")

    monkeypatch.setattr("app.weather.OPENWEATHER_API_KEY", "test-key")
    monkeypatch.setattr("app.weather.requests.get", lambda *_args, **_kwargs: FakeResponse())

    response = client.get("/weather/current", headers=auth, params={"city": "Boston"})
    assert response.status_code == 502
    assert response.json()["detail"] == "Weather provider returned invalid data"


def test_fetch_forecast_weather_uses_safe_numeric_fallbacks(monkeypatch):
    weather._forecast_cache.clear()
    forecast_dt = int(time.time()) + (24 * 60 * 60)

    monkeypatch.setattr(
        "app.weather._fetch_forecast_payload",
        lambda **_kwargs: {
            "city": {"name": "Boston"},
            "list": [
                {
                    "dt": forecast_dt,
                    "main": {"temp": 58.9},
                    "weather": [{"main": "Clouds", "description": "broken clouds"}],
                    "wind": {"speed": "not-a-number"},
                    "rain": {"3h": "invalid"},
                    "snow": {"3h": "bad"},
                }
            ],
        },
    )

    snapshot = weather.fetch_forecast_weather(city="Boston", hours_ahead=24)

    assert snapshot.city == "Boston"
    assert snapshot.temperature_f == 59
    assert snapshot.wind_mph == 0.0
    assert snapshot.rain_mm == 0.0
    assert snapshot.snow_mm == 0.0
