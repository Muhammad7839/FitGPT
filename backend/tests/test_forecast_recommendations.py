"""Forecast recommendation endpoint tests for weather-aware outfit planning."""

from app.weather import ForecastSnapshot, WeatherLookupError
from conftest import register_and_login


def _create_item(client, auth, *, category: str, color: str, clothing_type: str):
    response = client.post(
        "/wardrobe/items",
        headers=auth,
        json={
            "name": f"{color} {category}",
            "category": category,
            "clothing_type": clothing_type,
            "fit_tag": None,
            "color": color,
            "season": "All",
            "comfort_level": 3,
            "image_url": None,
            "brand": None,
            "is_available": True,
            "is_favorite": False,
            "is_archived": False,
            "last_worn_timestamp": None,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_forecast_recommendations_use_forecast_weather_context(client, monkeypatch):
    token = register_and_login(client, "forecast-reco@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", clothing_type="sneakers")
    _create_item(client, auth, category="Outerwear", color="Gray", clothing_type="jacket")

    monkeypatch.setattr(
        "app.routes.fetch_forecast_weather",
        lambda **_: ForecastSnapshot(
            city="Boston",
            forecast_timestamp=1767225600,
            temperature_f=39,
            weather_category="cold",
            condition="Rain",
            description="moderate rain",
            wind_mph=12.4,
            rain_mm=3.8,
            snow_mm=0.0,
            source="forecast",
        ),
    )
    monkeypatch.setattr("app.routes.ai_service.provider_client", type("Provider", (), {"is_available": False})())

    response = client.get("/recommendations/forecast", headers=auth, params={"city": "Boston", "hours_ahead": 24})
    assert response.status_code == 200
    body = response.json()
    assert body["forecast"]["city"] == "Boston"
    assert body["forecast"]["source"] == "forecast"
    assert body["forecast"]["weather_category"] == "cold"
    assert body["weather_category"] == "cold"
    assert body["items"]


def test_forecast_recommendations_fallback_when_forecast_unavailable(client, monkeypatch):
    token = register_and_login(client, "forecast-reco-fallback@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", clothing_type="sneakers")

    def raise_lookup_error(**_kwargs):
        raise WeatherLookupError("Weather provider is unavailable", status_code=503)

    monkeypatch.setattr("app.routes.fetch_forecast_weather", raise_lookup_error)
    monkeypatch.setattr("app.routes.ai_service.provider_client", type("Provider", (), {"is_available": False})())

    response = client.get(
        "/recommendations/forecast",
        headers=auth,
        params={"city": "Boston", "manual_temp": 58, "weather_category": "cool"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["forecast"]["source"] == "fallback"
    assert body["forecast"]["temperature_f"] == 58
    assert body["forecast"]["weather_category"] == "cool"
    assert body["fallback_used"] is True
    assert body["warning"] and "forecast_unavailable" in body["warning"]
