"""Weather lookup helpers used to enrich recommendation context."""

from dataclasses import dataclass
from typing import Any

import requests

from app.config import OPENWEATHER_API_KEY, OPENWEATHER_TIMEOUT_SECONDS


class WeatherLookupError(Exception):
    """Raised when weather information cannot be resolved for recommendations."""


@dataclass(frozen=True)
class WeatherSnapshot:
    """Minimal weather payload returned to app clients."""

    city: str
    temperature_f: int
    condition: str
    description: str


def fetch_current_weather(city: str) -> WeatherSnapshot:
    """Fetch current city weather from OpenWeather."""
    cleaned_city = city.strip()
    if not cleaned_city:
        raise WeatherLookupError("weather_city is required for weather lookup")
    if not OPENWEATHER_API_KEY:
        raise WeatherLookupError("Weather API is not configured")

    try:
        response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "q": cleaned_city,
                "appid": OPENWEATHER_API_KEY,
                "units": "imperial",
            },
            timeout=OPENWEATHER_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise WeatherLookupError("Weather lookup failed") from exc

    if response.status_code == 404:
        raise WeatherLookupError(f"City '{cleaned_city}' was not found")
    if not response.ok:
        raise WeatherLookupError("Weather lookup failed")

    payload: dict[str, Any] = response.json()
    main = payload.get("main")
    weather_entries = payload.get("weather")
    if not isinstance(main, dict) or "temp" not in main:
        raise WeatherLookupError("Weather data is unavailable")
    if not isinstance(weather_entries, list) or not weather_entries:
        raise WeatherLookupError("Weather data is unavailable")
    first_weather = weather_entries[0] if isinstance(weather_entries[0], dict) else {}

    try:
        temp_f = int(round(float(main["temp"])))
    except (TypeError, ValueError) as exc:
        raise WeatherLookupError("Weather data is unavailable") from exc

    condition = str(first_weather.get("main", "")).strip() or "Unknown"
    description = str(first_weather.get("description", "")).strip() or "Unknown conditions"
    city_name = str(payload.get("name", cleaned_city)).strip() or cleaned_city

    return WeatherSnapshot(
        city=city_name,
        temperature_f=temp_f,
        condition=condition,
        description=description,
    )


def fetch_current_temperature_f(city: str) -> int:
    """Fetch current city temperature from OpenWeather in Fahrenheit."""
    return fetch_current_weather(city).temperature_f
