"""Weather lookup helpers used to enrich recommendation context."""

from datetime import datetime
from dataclasses import dataclass
import time
from typing import Any, Optional

import requests

from app.config import OPENWEATHER_API_KEY, OPENWEATHER_TIMEOUT_SECONDS


class WeatherLookupError(Exception):
    """Raised when weather information cannot be resolved for recommendations."""

    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class WeatherSnapshot:
    """Minimal weather payload returned to app clients."""

    city: str
    temperature_f: int
    weather_category: str
    condition: str
    description: str


@dataclass(frozen=True)
class ForecastSnapshot:
    """Minimal day-level forecast payload used by planning features."""

    date: str
    temperature_f: int
    weather_category: str
    condition: str
    description: str


_FORECAST_CACHE: dict[str, tuple[int, list[ForecastSnapshot]]] = {}
_FORECAST_CACHE_TTL_SECONDS = 30 * 60


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
        raise WeatherLookupError("Weather service is not configured", status_code=503)

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
        raise WeatherLookupError("Weather network unavailable", status_code=503) from exc

    if response.status_code == 404:
        raise WeatherLookupError("Requested location was not found", status_code=400)
    if response.status_code in {401, 403}:
        raise WeatherLookupError("Weather service authentication failed", status_code=502)
    if response.status_code == 429:
        raise WeatherLookupError("Weather service quota exceeded", status_code=503)
    if response.status_code >= 500:
        raise WeatherLookupError("Weather provider is unavailable", status_code=503)
    if not response.ok:
        raise WeatherLookupError("Weather lookup failed", status_code=400)

    payload: dict[str, Any] = response.json()
    return payload


def _fetch_forecast_payload(*, city: Optional[str], lat: Optional[float], lon: Optional[float]) -> dict[str, Any]:
    if not OPENWEATHER_API_KEY:
        raise WeatherLookupError("Weather service is not configured", status_code=503)

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
            "https://api.openweathermap.org/data/2.5/forecast",
            params=params,
            timeout=OPENWEATHER_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise WeatherLookupError("Weather network unavailable", status_code=503) from exc

    if response.status_code == 404:
        raise WeatherLookupError("Requested location was not found", status_code=400)
    if response.status_code in {401, 403}:
        raise WeatherLookupError("Weather service authentication failed", status_code=502)
    if response.status_code == 429:
        raise WeatherLookupError("Weather service quota exceeded", status_code=503)
    if response.status_code >= 500:
        raise WeatherLookupError("Weather provider is unavailable", status_code=503)
    if not response.ok:
        raise WeatherLookupError("Weather lookup failed", status_code=400)

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


def fetch_forecast_weather(
    *,
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    days: int = 5,
) -> list[ForecastSnapshot]:
    """Fetch day-level weather forecast using OpenWeather's 5-day endpoint."""
    cleaned_city, resolved_lat, resolved_lon = _validate_lookup_inputs(city, lat, lon)
    normalized_days = max(1, min(days, 5))
    cache_key = f"{cleaned_city or ''}:{resolved_lat or ''}:{resolved_lon or ''}:{normalized_days}"
    now = int(time.time())
    cached = _FORECAST_CACHE.get(cache_key)
    if cached and (now - cached[0]) <= _FORECAST_CACHE_TTL_SECONDS:
        return cached[1]

    payload = _fetch_forecast_payload(
        city=cleaned_city,
        lat=resolved_lat,
        lon=resolved_lon,
    )
    entries = payload.get("list")
    if not isinstance(entries, list) or not entries:
        raise WeatherLookupError("Forecast data is unavailable")

    by_date: dict[str, list[dict[str, Any]]] = {}
    for raw_entry in entries:
        if not isinstance(raw_entry, dict):
            continue
        dt_text = str(raw_entry.get("dt_txt", "")).strip()
        try:
            date_key = datetime.strptime(dt_text, "%Y-%m-%d %H:%M:%S").date().isoformat()
        except ValueError:
            continue
        by_date.setdefault(date_key, []).append(raw_entry)

    snapshots: list[ForecastSnapshot] = []
    for date_key in sorted(by_date.keys())[:normalized_days]:
        day_entries = by_date[date_key]
        temps: list[float] = []
        conditions: dict[str, int] = {}
        descriptions: dict[str, int] = {}
        for day_entry in day_entries:
            main = day_entry.get("main")
            weather_items = day_entry.get("weather")
            if isinstance(main, dict) and "temp" in main:
                try:
                    temps.append(float(main["temp"]))
                except (TypeError, ValueError):
                    pass
            if isinstance(weather_items, list) and weather_items:
                first = weather_items[0] if isinstance(weather_items[0], dict) else {}
                condition = str(first.get("main", "")).strip() or "Unknown"
                description = str(first.get("description", "")).strip() or "Unknown conditions"
                conditions[condition] = conditions.get(condition, 0) + 1
                descriptions[description] = descriptions.get(description, 0) + 1

        if not temps:
            continue
        avg_temp = int(round(sum(temps) / len(temps)))
        dominant_condition = max(conditions.items(), key=lambda item: item[1])[0] if conditions else "Unknown"
        dominant_description = max(descriptions.items(), key=lambda item: item[1])[0] if descriptions else "Unknown conditions"
        snapshots.append(
            ForecastSnapshot(
                date=date_key,
                temperature_f=avg_temp,
                weather_category=map_temperature_to_category(avg_temp),
                condition=dominant_condition,
                description=dominant_description,
            )
        )

    if not snapshots:
        raise WeatherLookupError("Forecast data is unavailable")
    _FORECAST_CACHE[cache_key] = (now, snapshots)
    return snapshots
