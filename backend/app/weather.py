"""Weather lookup helpers used to enrich recommendation context."""

from dataclasses import dataclass
from typing import Any, Optional

import requests

from app.config import OPENWEATHER_API_KEY, OPENWEATHER_TIMEOUT_SECONDS


class WeatherLookupError(Exception):
    """Raised when weather information cannot be resolved for recommendations."""


@dataclass(frozen=True)
class WeatherSnapshot:
    """Minimal weather payload returned to app clients."""

    city: str
    temperature_f: int
    weather_category: str
    condition: str
    description: str


def map_temperature_to_category(temp_f: int) -> str:
    """Map Fahrenheit temperature to recommendation-friendly category."""
    if temp_f <= 40:
        return "cold"
    if temp_f <= 55:
        return "cool"
    if temp_f <= 70:
        return "mild"
    if temp_f <= 82:
        return "warm"
    return "hot"


def _validate_lookup_inputs(city: Optional[str], lat: Optional[float], lon: Optional[float]) -> tuple[Optional[str], Optional[float], Optional[float]]:
    cleaned_city = city.strip() if city else None
    if cleaned_city:
        return cleaned_city, None, None

    if lat is None and lon is None:
        raise WeatherLookupError("Provide either city or latitude/longitude for weather lookup")
    if lat is None or lon is None:
        raise WeatherLookupError("Both latitude and longitude are required")
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise WeatherLookupError("Latitude/longitude are out of bounds")

    return None, lat, lon


def _fetch_weather_payload(*, city: Optional[str], lat: Optional[float], lon: Optional[float]) -> dict[str, Any]:
    if not OPENWEATHER_API_KEY:
        raise WeatherLookupError("Weather API is not configured")

    params: dict[str, Any] = {
        "appid": OPENWEATHER_API_KEY,
        "units": "imperial",
    }
    if city:
        params["q"] = city
    else:
        params["lat"] = lat
        params["lon"] = lon

    try:
        response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
            timeout=OPENWEATHER_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise WeatherLookupError("Weather lookup failed") from exc

    if response.status_code == 404:
        raise WeatherLookupError("Requested location was not found")
    if not response.ok:
        raise WeatherLookupError("Weather lookup failed")

    payload: dict[str, Any] = response.json()
    return payload


def fetch_current_weather(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> WeatherSnapshot:
    """Fetch current weather from OpenWeather by city or coordinates."""
    cleaned_city, resolved_lat, resolved_lon = _validate_lookup_inputs(city, lat, lon)
    payload = _fetch_weather_payload(
        city=cleaned_city,
        lat=resolved_lat,
        lon=resolved_lon,
    )

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
    fallback_city = cleaned_city or "Current location"
    city_name = str(payload.get("name", fallback_city)).strip() or fallback_city

    return WeatherSnapshot(
        city=city_name,
        temperature_f=temp_f,
        weather_category=map_temperature_to_category(temp_f),
        condition=condition,
        description=description,
    )


def fetch_current_temperature_f(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> int:
    """Fetch current temperature from OpenWeather in Fahrenheit."""
    return fetch_current_weather(city=city, lat=lat, lon=lon).temperature_f
