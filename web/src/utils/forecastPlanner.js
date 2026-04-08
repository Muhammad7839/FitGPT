import {
  generateThreeOutfits,
  normalizeCategory,
  scoreOutfitForDisplay,
  signatureFromItems,
  titleCase,
  weatherCategoryFromTempF,
} from "./recommendationEngine";

const DEFAULT_BODY_TYPE = "rectangle";
const DEFAULT_TIME_CATEGORY = "work hours";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function itemText(item) {
  return [
    item?.name,
    item?.category,
    item?.clothing_type,
    item?.type,
    ...(Array.isArray(item?.style_tags) ? item.style_tags : []),
    ...(Array.isArray(item?.occasion_tags) ? item.occasion_tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasKeyword(item, keywords) {
  const text = itemText(item);
  return keywords.some((keyword) => text.includes(keyword));
}

function isOuterwearItem(item) {
  const category = normalizeCategory(item?.category);
  const layerType = (item?.layer_type || "").toString().trim().toLowerCase();
  return category === "Outerwear" || layerType === "outer";
}

function isShoeItem(item) {
  return normalizeCategory(item?.category) === "Shoes";
}

function analyzeOutfitSignals(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  const layerCount = items.filter((item) => item?.layer_type).length;
  let outerwear = 0;
  let warmPieces = 0;
  let breathablePieces = 0;
  let waterproofPieces = 0;
  let openShoes = 0;
  let closedShoes = 0;
  let sunPieces = 0;

  for (const item of items) {
    if (isOuterwearItem(item)) outerwear += 1;

    if (
      isOuterwearItem(item) ||
      hasKeyword(item, ["coat", "parka", "fleece", "sweater", "knit", "hoodie", "wool", "thermal", "boot"])
    ) {
      warmPieces += 1;
    }

    if (
      hasKeyword(item, ["tee", "t-shirt", "tank", "linen", "cotton", "shorts", "skirt", "dress", "polo", "sneaker", "flat"])
    ) {
      breathablePieces += 1;
    }

    if (
      isOuterwearItem(item) ||
      hasKeyword(item, ["rain", "waterproof", "trench", "parka", "windbreaker", "shell", "boot"])
    ) {
      waterproofPieces += 1;
    }

    if (isShoeItem(item)) {
      if (hasKeyword(item, ["sandal", "slide", "flip flop", "flip-flop", "open toe", "open-toe", "heel", "mule"])) {
        openShoes += 1;
      } else {
        closedShoes += 1;
      }
    }

    if (hasKeyword(item, ["sunglass", "hat", "cap", "visor"])) {
      sunPieces += 1;
    }
  }

  return {
    outerwear,
    warmPieces,
    breathablePieces,
    waterproofPieces,
    openShoes,
    closedShoes,
    sunPieces,
    layerCount,
  };
}

function isWetForecast(day) {
  const chance = safeNumber(day?.precipitationChance) || 0;
  const amount = safeNumber(day?.precipitationIn) || 0;
  const key = (day?.conditionKey || "").toString().trim().toLowerCase();
  return chance >= 45 || amount >= 0.04 || ["rain", "snow", "storm"].includes(key);
}

function isSevereForecast(day) {
  const chance = safeNumber(day?.precipitationChance) || 0;
  const amount = safeNumber(day?.precipitationIn) || 0;
  const key = (day?.conditionKey || "").toString().trim().toLowerCase();
  return chance >= 70 || amount >= 0.2 || ["storm", "snow"].includes(key);
}

function isWindyForecast(day) {
  return (safeNumber(day?.windMph) || 0) >= 18;
}

function daySeed(baseSeed, date, index) {
  const start = Number.isFinite(Number(baseSeed)) ? Number(baseSeed) : Date.now();
  const stamp = (date || "").split("-").join("");
  const dateNumber = Number(stamp);
  return start + (Number.isFinite(dateNumber) ? dateNumber : 0) + index * 97;
}

export function forecastWeatherCategory(day) {
  const averageTemp = safeNumber(day?.averageTempF);
  const high = safeNumber(day?.tempHighF);
  const low = safeNumber(day?.tempLowF);
  let effectiveTemp = averageTemp;

  if (!Number.isFinite(effectiveTemp)) {
    if (Number.isFinite(high) && Number.isFinite(low)) effectiveTemp = (high + low) / 2;
    else effectiveTemp = Number.isFinite(high) ? high : low;
  }

  if (!Number.isFinite(effectiveTemp)) return "mild";

  if (isWetForecast(day)) effectiveTemp -= 3;
  if (isWindyForecast(day)) effectiveTemp -= 2;

  return weatherCategoryFromTempF(effectiveTemp);
}

export function scoreOutfitForForecast(outfit, day, { answers, bodyTypeId, timeCategory } = {}) {
  const weatherCategory = forecastWeatherCategory(day);
  const signals = analyzeOutfitSignals(outfit);
  let score = scoreOutfitForDisplay(outfit, {
    weatherCategory,
    timeCategory: timeCategory || DEFAULT_TIME_CATEGORY,
    answers,
    bodyTypeId: bodyTypeId || DEFAULT_BODY_TYPE,
  });

  if (weatherCategory === "cold" || weatherCategory === "cool") {
    score += signals.outerwear * 14;
    score += signals.warmPieces * 8;
    if (signals.layerCount >= 2) score += 10;
    if (weatherCategory === "cold" && signals.outerwear === 0) score -= 18;
  }

  if (weatherCategory === "warm" || weatherCategory === "hot") {
    score += signals.breathablePieces * 10;
    score -= signals.outerwear * 16;
    score -= Math.max(0, signals.warmPieces - signals.outerwear) * 6;
  }

  if (isWetForecast(day)) {
    score += signals.waterproofPieces * 12;
    score += signals.closedShoes * 8;
    score -= signals.openShoes * 12;
    if (isSevereForecast(day) && signals.outerwear === 0 && signals.waterproofPieces === 0) score -= 14;
  }

  if (isWindyForecast(day)) {
    score += signals.outerwear > 0 ? 6 : -2;
    score += signals.layerCount >= 2 ? 4 : 0;
  }

  if ((day?.conditionKey || "") === "clear") {
    score += signals.sunPieces * 4;
  }

  return score;
}

export function buildForecastSuggestionReason(day, outfit) {
  const weatherCategory = forecastWeatherCategory(day);
  const signals = analyzeOutfitSignals(outfit);
  const reasons = [];

  if (isWetForecast(day)) {
    if (signals.waterproofPieces > 0 || signals.outerwear > 0) {
      reasons.push("Rain protection is doing most of the work here.");
    } else {
      reasons.push("The look stays balanced even without a dedicated rain layer.");
    }
  }

  if ((weatherCategory === "cold" || weatherCategory === "cool") && reasons.length < 2) {
    if (signals.layerCount >= 2 || signals.outerwear > 0) {
      reasons.push("Layering helps this stay wearable in cooler air.");
    } else {
      reasons.push("The outfit keeps coverage simple for the cooler temperature.");
    }
  }

  if ((weatherCategory === "warm" || weatherCategory === "hot") && reasons.length < 2) {
    if (signals.breathablePieces > 0) {
      reasons.push("It leans lighter so the outfit feels easier in warmer weather.");
    } else {
      reasons.push("The pieces keep the silhouette light enough for a warmer day.");
    }
  }

  if (isWindyForecast(day) && reasons.length < 2) {
    reasons.push("A bit more structure helps when the wind picks up.");
  }

  if (reasons.length === 0) {
    reasons.push("This is a balanced outfit built around the forecast and your wardrobe.");
  }

  return reasons.slice(0, 2).join(" ");
}

function buildForecastSummary(day) {
  const parts = [];

  if (Number.isFinite(safeNumber(day?.tempHighF)) && Number.isFinite(safeNumber(day?.tempLowF))) {
    parts.push(`${Math.round(day.tempHighF)}F / ${Math.round(day.tempLowF)}F`);
  }

  if (Number.isFinite(safeNumber(day?.precipitationChance))) {
    parts.push(`${Math.round(day.precipitationChance)}% precip`);
  }

  if (Number.isFinite(safeNumber(day?.windMph))) {
    parts.push(`${Math.round(day.windMph)} mph wind`);
  }

  return parts.join(" • ");
}

export function buildForecastSuggestions({
  wardrobe,
  forecastDays,
  seedNumber,
  bodyTypeId,
  recentItemCounts,
  timeCategory,
  answers,
  savedSigs,
}) {
  const days = Array.isArray(forecastDays) ? forecastDays : [];
  const usedSignatures = new Set();

  return days.map((day, index) => {
    const weatherCategory = forecastWeatherCategory(day);
    const outfitOptions = generateThreeOutfits(
      wardrobe,
      daySeed(seedNumber, day?.date, index),
      bodyTypeId || DEFAULT_BODY_TYPE,
      new Set(),
      recentItemCounts instanceof Map ? recentItemCounts : new Map(),
      weatherCategory,
      timeCategory || DEFAULT_TIME_CATEGORY,
      answers,
      savedSigs instanceof Set ? savedSigs : new Set()
    );

    const ranked = outfitOptions
      .map((outfit) => {
        const signature = signatureFromItems(outfit);
        return {
          outfit,
          signature,
          score: scoreOutfitForForecast(outfit, day, {
            answers,
            bodyTypeId: bodyTypeId || DEFAULT_BODY_TYPE,
            timeCategory: timeCategory || DEFAULT_TIME_CATEGORY,
          }),
        };
      })
      .sort((a, b) => {
        const aUsed = a.signature && usedSignatures.has(a.signature) ? 1 : 0;
        const bUsed = b.signature && usedSignatures.has(b.signature) ? 1 : 0;
        return (aUsed - bUsed) || (b.score - a.score);
      });

    const selected = ranked[0] || { outfit: [], signature: "", score: 0 };
    if (selected.signature) usedSignatures.add(selected.signature);

    return {
      ...day,
      weatherCategory,
      title: titleCase(day?.condition || "forecast"),
      summary: buildForecastSummary(day),
      outfit: Array.isArray(selected.outfit) ? selected.outfit : [],
      score: selected.score,
      note: buildForecastSuggestionReason(day, selected.outfit),
    };
  });
}

export function buildFallbackPlanningSuggestion({
  wardrobe,
  seedNumber,
  bodyTypeId,
  recentItemCounts,
  timeCategory,
  answers,
  savedSigs,
}) {
  const outfit = generateThreeOutfits(
    wardrobe,
    daySeed(seedNumber, "fallback", 0),
    bodyTypeId || DEFAULT_BODY_TYPE,
    new Set(),
    recentItemCounts instanceof Map ? recentItemCounts : new Map(),
    "mild",
    timeCategory || DEFAULT_TIME_CATEGORY,
    answers,
    savedSigs instanceof Set ? savedSigs : new Set()
  )[0] || [];

  return {
    title: "General planning suggestion",
    summary: "A balanced look from your wardrobe",
    weatherCategory: "mild",
    outfit,
    note: "Weather data is unavailable, so this suggestion stays flexible until a live forecast is available.",
  };
}
