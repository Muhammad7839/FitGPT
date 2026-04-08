import { readWeatherOverride } from "../utils/userStorage";

function tempCategoryFromF(tempF) {
  const t = Number(tempF);
  if (!Number.isFinite(t)) return "mild";
  if (t <= 40) return "cold";
  if (t <= 55) return "cool";
  if (t <= 70) return "mild";
  if (t <= 85) return "warm";
  return "hot";
}

function precipFromWmoCode(code) {
  const c = Number(code);
  if (!Number.isFinite(c)) return "clear";
  if (c <= 48) return "clear";
  if (c <= 57) return "rain";
  if (c <= 67) return "rain";
  if (c <= 77) return "snow";
  if (c <= 82) return "rain";
  if (c <= 86) return "snow";
  return "storm";
}

async function getCoordsFromBrowser() {
  if (!("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (typeof lat === "number" && typeof lon === "number") resolve({ lat, lon });
        else resolve(null);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

async function fetchOpenMeteoWeather({ lat, lon }) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&current=temperature_2m,weather_code" +
    "&temperature_unit=fahrenheit";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed.");
  const data = await res.json();

  const tempF = data?.current?.temperature_2m;
  if (typeof tempF !== "number") throw new Error("Weather data missing temperature.");
  const weatherCode = data?.current?.weather_code;
  return { tempF, precipCondition: precipFromWmoCode(weatherCode) };
}

function buildForecastUrl({ lat, lon, days }) {
  const forecastDays = Math.max(1, Math.min(Number(days) || 6, 10));

  return (
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&precipitation_unit=inch" +
    `&forecast_days=${forecastDays}` +
    "&timezone=auto"
  );
}

async function fetchOpenMeteoForecast({ lat, lon, days = 6 }) {
  const res = await fetch(buildForecastUrl({ lat, lon, days }));
  if (!res.ok) throw new Error("Forecast request failed.");
  const data = await res.json();
  const normalized = normalizeForecastDays(data, days);
  if (!normalized.length) throw new Error("Forecast data missing.");
  return normalized;
}

export async function getWeatherContext() {
  const override = readWeatherOverride();
  if (override) {
    return {
      status: "ok",
      source: "override",
      tempF: null,
      category: override,
      precipCondition: "clear",
      message: "",
    };
  }

  const coords = await getCoordsFromBrowser();
  if (!coords) {
    return {
      status: "fallback",
      source: "fallback",
      tempF: null,
      category: "mild",
      precipCondition: "clear",
      message: "Weather unavailable, using default recommendations.",
    };
  }

  try {
    const weather = await fetchOpenMeteoWeather(coords);
    return {
      status: "ok",
      source: "auto",
      tempF: weather.tempF,
      category: tempCategoryFromF(weather.tempF),
      precipCondition: weather.precipCondition,
      message: "",
    };
  } catch {
    return {
      status: "fallback",
      source: "fallback",
      tempF: null,
      category: "mild",
      precipCondition: "clear",
      message: "Weather unavailable, using default recommendations.",
    };
  }
}

export async function getWeatherForecast(days = 6) {
  const coords = await getCoordsFromBrowser();
  if (!coords) {
    return {
      status: "fallback",
      source: "fallback",
      days: [],
      message: "Weather data is unavailable, showing general recommendations.",
    };
  }

  try {
    const forecastDays = await fetchOpenMeteoForecast({ ...coords, days });
    return {
      status: "ok",
      source: "auto",
      days: forecastDays,
      message: "",
    };
  } catch {
    return {
      status: "fallback",
      source: "fallback",
      days: [],
      message: "Weather data is unavailable, showing general recommendations.",
    };
  }
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const WEATHER_CODE_LABELS = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Intense showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

export function conditionFromWeatherCode(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) {
    return { label: "Mixed conditions", icon: "\u26C5", key: "mixed" };
  }

  if (numeric === 0 || numeric === 1) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\u2600\uFE0F", key: "clear" };
  }
  if (numeric === 2 || numeric === 3) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\u2601\uFE0F", key: "cloudy" };
  }
  if (numeric === 45 || numeric === 48) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\uD83C\uDF2B\uFE0F", key: "fog" };
  }
  if ((numeric >= 51 && numeric <= 67) || (numeric >= 80 && numeric <= 82)) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\uD83C\uDF27\uFE0F", key: "rain" };
  }
  if ((numeric >= 71 && numeric <= 77) || numeric === 85 || numeric === 86) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\u2744\uFE0F", key: "snow" };
  }
  if (numeric >= 95) {
    return { label: WEATHER_CODE_LABELS[numeric], icon: "\u26C8\uFE0F", key: "storm" };
  }

  return { label: WEATHER_CODE_LABELS[numeric] || "Mixed conditions", icon: "\u26C5", key: "mixed" };
}

function normalizeForecastDays(data, days) {
  const daily = data?.daily || {};
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const highs = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const lows = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rainChances = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];
  const rainTotals = Array.isArray(daily?.precipitation_sum) ? daily.precipitation_sum : [];
  const weatherCodes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const winds = Array.isArray(daily?.wind_speed_10m_max) ? daily.wind_speed_10m_max : [];

  return dates.slice(0, days).map((date, index) => {
    const tempHighF = safeNumber(highs[index]);
    const tempLowF = safeNumber(lows[index]);
    const precipitationChance = safeNumber(rainChances[index]);
    const precipitationIn = safeNumber(rainTotals[index]);
    const windMph = safeNumber(winds[index]);
    const weatherCode = safeNumber(weatherCodes[index]);
    const condition = conditionFromWeatherCode(weatherCode);
    const averageTempF = Number.isFinite(tempHighF) && Number.isFinite(tempLowF)
      ? Math.round(((tempHighF + tempLowF) / 2) * 10) / 10
      : Number.isFinite(tempHighF)
        ? tempHighF
        : tempLowF;

    return {
      date,
      weatherCode,
      condition: condition.label,
      conditionKey: condition.key,
      icon: condition.icon,
      tempHighF,
      tempLowF,
      averageTempF,
      precipitationChance,
      precipitationIn,
      windMph,
    };
  });
}

async function geocodeDestination(query) {
  const term = (query || "").toString().trim();
  if (!term) return null;

  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(term)}` +
    "&count=1&language=en&format=json";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Destination lookup failed.");
  const data = await res.json();
  const result = Array.isArray(data?.results) ? data.results[0] : null;
  if (!result) return null;

  const parts = [result?.name, result?.admin1, result?.country].filter(Boolean);
  return {
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    timezone: result?.timezone || "auto",
    label: parts.join(", "),
  };
}

function buildRangeForecastUrl({ lat, lon, startDate, endDate, timezone }) {
  return (
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&start_date=${encodeURIComponent(startDate)}` +
    `&end_date=${encodeURIComponent(endDate)}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max" +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&precipitation_unit=inch" +
    `&timezone=${encodeURIComponent(timezone || "auto")}`
  );
}

async function fetchOpenMeteoForecastRange({ lat, lon, startDate, endDate, timezone = "auto" }) {
  const res = await fetch(buildRangeForecastUrl({ lat, lon, startDate, endDate, timezone }));
  if (!res.ok) throw new Error("Destination forecast request failed.");
  const data = await res.json();
  const dateCount = Array.isArray(data?.daily?.time) ? data.daily.time.length : 0;
  const normalized = normalizeForecastDays(data, dateCount);
  if (!normalized.length) throw new Error("Destination forecast missing.");
  return normalized;
}

export async function getDestinationWeatherForecast({ destination, startDate, endDate }) {
  const place = (destination || "").toString().trim();
  const start = (startDate || "").toString().trim();
  const end = (endDate || "").toString().trim();

  if (!place || !start || !end) {
    return {
      status: "fallback",
      source: "fallback",
      location: null,
      days: [],
      message: "Trip details are incomplete, showing a general packing suggestion.",
    };
  }

  try {
    const location = await geocodeDestination(place);
    if (!location) {
      return {
        status: "fallback",
        source: "fallback",
        location: null,
        days: [],
        message: "Destination weather is unavailable, showing general packing suggestions.",
      };
    }

    const days = await fetchOpenMeteoForecastRange({
      lat: location.latitude,
      lon: location.longitude,
      startDate: start,
      endDate: end,
      timezone: location.timezone,
    });

    return {
      status: "ok",
      source: "destination",
      location,
      days,
      message: "",
    };
  } catch {
    return {
      status: "fallback",
      source: "fallback",
      location: null,
      days: [],
      message: "Weather data is unavailable, showing general packing suggestions.",
    };
  }
}
