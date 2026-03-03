const OVERRIDE_KEY = "fitgpt_weather_override_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function tempCategoryFromF(tempF) {
  const t = Number(tempF);
  if (!Number.isFinite(t)) return "mild";
  if (t <= 40) return "cold";
  if (t <= 55) return "cool";
  if (t <= 70) return "mild";
  if (t <= 85) return "warm";
  return "hot";
}

export function labelForTempCategory(cat) {
  const c = (cat || "").toString().trim().toLowerCase();
  if (c === "cold") return "Cold";
  if (c === "cool") return "Cool";
  if (c === "mild") return "Mild";
  if (c === "warm") return "Warm";
  if (c === "hot") return "Hot";
  return "Mild";
}

export function readWeatherOverride() {
  const raw = sessionStorage.getItem(OVERRIDE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const v = (parsed?.category || "").toString().trim().toLowerCase();
  const allowed = new Set(["cold", "cool", "mild", "warm", "hot"]);
  return allowed.has(v) ? v : null;
}

export function setWeatherOverride(categoryOrNull) {
  const v = (categoryOrNull || "").toString().trim().toLowerCase();
  const allowed = new Set(["cold", "cool", "mild", "warm", "hot"]);
  if (!allowed.has(v)) {
    sessionStorage.removeItem(OVERRIDE_KEY);
    return;
  }
  sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify({ category: v }));
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

async function fetchOpenMeteoTempF({ lat, lon }) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&current=temperature_2m" +
    "&temperature_unit=fahrenheit";

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed.");
  const data = await res.json();

  const tempF = data?.current?.temperature_2m;
  if (typeof tempF !== "number") throw new Error("Weather data missing temperature.");
  return tempF;
}

export async function getWeatherContext() {
  const override = readWeatherOverride();
  if (override) {
    return {
      status: "ok",
      source: "override",
      tempF: null,
      category: override,
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
      message: "Weather unavailable, using default recommendations.",
    };
  }

  try {
    const tempF = await fetchOpenMeteoTempF(coords);
    return {
      status: "ok",
      source: "auto",
      tempF,
      category: tempCategoryFromF(tempF),
      message: "",
    };
  } catch {
    return {
      status: "fallback",
      source: "fallback",
      tempF: null,
      category: "mild",
      message: "Weather unavailable, using default recommendations.",
    };
  }
}