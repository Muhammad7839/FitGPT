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
