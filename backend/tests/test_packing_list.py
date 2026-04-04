"""Integration tests for trip packing list generation and forecast adjustments."""

from conftest import register_and_login
from app.weather import ForecastSnapshot, WeatherLookupError


def _item_payload(name: str, category: str) -> dict:
    return {
        "name": name,
        "category": category,
        "clothing_type": "basic",
        "fit_tag": "regular",
        "color": "Black",
        "season": "All",
        "comfort_level": 4,
        "image_url": None,
        "brand": "FitGPT",
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def _seed_basic_wardrobe(client, auth: dict) -> None:
    for name, category in [
        ("Top A", "Top"),
        ("Top B", "Top"),
        ("Bottom A", "Bottom"),
        ("Shoes A", "Shoes"),
        ("Jacket A", "Outerwear"),
    ]:
        response = client.post("/wardrobe/items", json=_item_payload(name, category), headers=auth)
        assert response.status_code == 200


def test_packing_list_generation_returns_quantities(client, monkeypatch):
    token = register_and_login(client, "packing-basic@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_basic_wardrobe(client, auth)

    monkeypatch.setattr(
        "app.routes.fetch_forecast_weather",
        lambda **_: [
            ForecastSnapshot(
                date="2026-07-01",
                temperature_f=84,
                weather_category="hot",
                condition="Clear",
                description="clear sky",
            )
        ],
    )

    response = client.post(
        "/plans/packing-list",
        headers=auth,
        json={"destination_city": "Miami", "start_date": "2026-07-01", "trip_days": 3},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["destination_city"] == "Miami"
    assert body["trip_days"] == 3
    assert body["items"]
    top_item = next(item for item in body["items"] if item["category"] == "top")
    assert top_item["recommended_quantity"] == 3



def test_packing_list_applies_weather_based_outerwear_adjustment(client, monkeypatch):
    token = register_and_login(client, "packing-weather@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_basic_wardrobe(client, auth)

    monkeypatch.setattr(
        "app.routes.fetch_forecast_weather",
        lambda **_: [
            ForecastSnapshot(
                date="2026-01-10",
                temperature_f=30,
                weather_category="cold",
                condition="Snow",
                description="light snow",
            )
        ],
    )

    response = client.post(
        "/plans/packing-list",
        headers=auth,
        json={"destination_city": "Chicago", "start_date": "2026-01-10", "trip_days": 4},
    )
    assert response.status_code == 200
    body = response.json()
    outerwear = next(item for item in body["items"] if item["category"] == "outerwear")
    assert outerwear["recommended_quantity"] == 1



def test_packing_list_handles_forecast_failure_and_sparse_data(client, monkeypatch):
    token = register_and_login(client, "packing-edge@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response_item = client.post("/wardrobe/items", json=_item_payload("Top A", "Top"), headers=auth)
    assert response_item.status_code == 200

    def _raise_forecast(**_):
        raise WeatherLookupError("Forecast unavailable", status_code=503)

    def _raise_current(**_):
        raise WeatherLookupError("Current weather unavailable", status_code=503)

    monkeypatch.setattr("app.routes.fetch_forecast_weather", _raise_forecast)
    monkeypatch.setattr("app.routes.fetch_current_weather", _raise_current)

    response = client.post(
        "/plans/packing-list",
        headers=auth,
        json={"destination_city": "Unknown", "start_date": "2026-04-01", "trip_days": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["insufficient_data"] is True
    assert body["weather_summary"] == "Forecast unavailable"
