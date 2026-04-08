import { makeId } from "./helpers";
import { normalizeCategory, titleCase, weatherCategoryFromTempF } from "./recommendationEngine";
import { buildFallbackPlanningSuggestion, buildForecastSuggestions } from "./forecastPlanner";

export const TRIP_LUGGAGE_OPTIONS = [
  { key: "carry-on", label: "Carry on", description: "Light and efficient for shorter trips." },
  { key: "checked", label: "Checked bag", description: "More room for outfit changes and weather swings." },
  { key: "combo", label: "Carry on + Checked bag", description: "Best when you want flexibility and extra space." },
];

export const TRIP_ACTIVITY_SUGGESTIONS = [
  "City exploring",
  "Dinner out",
  "Beach day",
  "Hiking",
  "Business meetings",
  "Museum visits",
  "Travel day",
  "Workout",
];

const CATEGORY_LABELS = {
  tops: "Tops",
  bottoms: "Bottoms",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessories: "Accessories",
  essentials: "Essentials",
};

const DEFAULT_BODY_TYPE = "rectangle";

function toDate(value) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function tripDurationDays(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff + 1 : 0;
}

export function buildTripDateRange(startDate, endDate) {
  const totalDays = tripDurationDays(startDate, endDate);
  const start = toDate(startDate);
  if (!totalDays || !start) return [];

  return Array.from({ length: totalDays }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, "0");
    const day = String(next.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function tripWeatherSummary(days) {
  const tripDays = Array.isArray(days) ? days : [];
  const highs = tripDays.map((day) => safeNumber(day?.tempHighF)).filter(Number.isFinite);
  const lows = tripDays.map((day) => safeNumber(day?.tempLowF)).filter(Number.isFinite);
  const rainChances = tripDays.map((day) => safeNumber(day?.precipitationChance)).filter(Number.isFinite);
  const conditionKeys = [...new Set(tripDays.map((day) => (day?.conditionKey || "").toString().trim().toLowerCase()).filter(Boolean))];
  const averageTemp = highs.length && lows.length
    ? (Math.max(...highs) + Math.min(...lows)) / 2
    : highs.length
      ? highs.reduce((sum, value) => sum + value, 0) / highs.length
      : lows.length
        ? lows.reduce((sum, value) => sum + value, 0) / lows.length
        : null;

  return {
    highestTempF: highs.length ? Math.max(...highs) : null,
    lowestTempF: lows.length ? Math.min(...lows) : null,
    peakRainChance: rainChances.length ? Math.max(...rainChances) : 0,
    weatherCategory: weatherCategoryFromTempF(averageTemp),
    conditionKeys,
  };
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

function keywordBoost(item, keywords) {
  const text = itemText(item);
  return keywords.some((keyword) => text.includes(keyword)) ? 1 : 0;
}

function categoryKeyFromItem(item) {
  const category = normalizeCategory(item?.category);
  if (category === "Tops") return "tops";
  if (category === "Bottoms") return "bottoms";
  if (category === "Outerwear") return "outerwear";
  if (category === "Shoes") return "shoes";
  if (category === "Accessories") return "accessories";
  return "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantityTemplate({ durationDays, weather, luggageMode, activities }) {
  const days = Math.max(1, durationDays || 1);
  const activityCount = Array.isArray(activities) ? activities.length : 0;
  const wetTrip = (weather.peakRainChance || 0) >= 45 || weather.conditionKeys.some((key) => ["rain", "snow", "storm"].includes(key));
  const coldTrip = weather.weatherCategory === "cold" || weather.weatherCategory === "cool";
  const warmTrip = weather.weatherCategory === "warm" || weather.weatherCategory === "hot";

  const carryMultiplier = luggageMode === "carry-on" ? 0.82 : luggageMode === "combo" ? 1.08 : 1;

  const tops = clamp(Math.round((days <= 3 ? days : Math.ceil(days * 0.7) + 1) * carryMultiplier), 1, Math.max(days, 3));
  const bottoms = clamp(Math.round(Math.max(1, Math.ceil(days / 2.5)) * (luggageMode === "checked" ? 1.1 : 1)), 1, Math.max(2, days));
  const outerwear = coldTrip || wetTrip ? 1 : 0;
  const shoes = clamp((luggageMode === "carry-on" ? 1 : days > 3 || activityCount > 1 || wetTrip ? 2 : 1) + (luggageMode === "combo" && activityCount > 2 ? 1 : 0), 1, 3);
  const accessories = coldTrip ? 2 : warmTrip ? 1 : 1;
  const essentials = {
    underwear: days * 2,
    socks: coldTrip ? days * 2 : days + 1,
    sleepwear: Math.max(1, Math.ceil(days / 4)),
  };

  const specialty = [];
  if (coldTrip) specialty.push({ key: "layer", label: "Warm layer", quantity: Math.max(1, Math.ceil(days / 3)) });
  if (wetTrip) specialty.push({ key: "rain", label: "Rain-ready piece", quantity: 1 });
  if (activities.some((activity) => activity.toLowerCase().includes("hiking"))) specialty.push({ key: "trail", label: "Trail outfit", quantity: 1 });
  if (activities.some((activity) => activity.toLowerCase().includes("beach"))) specialty.push({ key: "sun", label: "Sun accessory", quantity: 1 });

  return {
    tops,
    bottoms,
    outerwear,
    shoes,
    accessories,
    essentials,
    specialty,
  };
}

function scoreWardrobeItem(item, categoryKey, weather, tripPurpose, activities) {
  let score = 0;
  const text = itemText(item);
  const purpose = (tripPurpose || "").toString().trim().toLowerCase();
  const lowerActivities = (Array.isArray(activities) ? activities : []).map((activity) => activity.toLowerCase());

  if (categoryKey === "tops") {
    if (weather.weatherCategory === "hot" || weather.weatherCategory === "warm") score += keywordBoost(item, ["tee", "tank", "linen", "cotton", "blouse", "shirt"]) * 8;
    if (weather.weatherCategory === "cold" || weather.weatherCategory === "cool") score += keywordBoost(item, ["sweater", "hoodie", "long sleeve", "knit", "thermal"]) * 8;
  }

  if (categoryKey === "bottoms") {
    if (weather.weatherCategory === "hot" || weather.weatherCategory === "warm") score += keywordBoost(item, ["shorts", "skirt", "linen"]) * 8;
    if (weather.weatherCategory === "cold" || weather.weatherCategory === "cool") score += keywordBoost(item, ["jeans", "trouser", "pants", "leggings"]) * 7;
  }

  if (categoryKey === "outerwear") {
    score += keywordBoost(item, ["coat", "jacket", "blazer", "trench", "hoodie", "cardigan", "rain"]) * 10;
    if ((weather.peakRainChance || 0) >= 45) score += keywordBoost(item, ["rain", "trench", "shell", "windbreaker", "waterproof"]) * 8;
  }

  if (categoryKey === "shoes") {
    if (weather.weatherCategory === "hot") score += keywordBoost(item, ["sandal", "slide", "flat"]) * 7;
    if (weather.weatherCategory === "cold" || (weather.peakRainChance || 0) >= 45) score += keywordBoost(item, ["boot", "sneaker", "loafer"]) * 8;
  }

  if (categoryKey === "accessories") {
    if (weather.weatherCategory === "hot") score += keywordBoost(item, ["hat", "sunglass", "visor"]) * 8;
    if (weather.weatherCategory === "cold" || weather.weatherCategory === "cool") score += keywordBoost(item, ["scarf", "hat", "glove"]) * 8;
  }

  if (purpose.includes("business") || purpose.includes("work")) {
    score += keywordBoost(item, ["blazer", "button", "loafer", "trouser", "shirt", "dress"]) * 7;
  }

  if (purpose.includes("beach")) {
    score += keywordBoost(item, ["shorts", "tank", "sandal", "hat", "sunglass"]) * 7;
  }

  if (lowerActivities.some((activity) => activity.includes("hiking") || activity.includes("workout"))) {
    score += keywordBoost(item, ["boot", "sneaker", "legging", "athletic", "active", "hoodie"]) * 7;
  }

  if (lowerActivities.some((activity) => activity.includes("dinner") || activity.includes("museum"))) {
    score += keywordBoost(item, ["dress", "blazer", "button", "loafer", "flat", "jacket"]) * 5;
  }

  if (text.includes("black") || text.includes("white") || text.includes("navy") || text.includes("beige")) score += 2;
  return score;
}

function distributeQuantity(totalQuantity, itemCount) {
  if (!itemCount) return [];
  const base = Math.floor(totalQuantity / itemCount);
  const remainder = totalQuantity % itemCount;
  return Array.from({ length: itemCount }, (_, index) => base + (index < remainder ? 1 : 0)).filter((value) => value > 0);
}

function fallbackName(categoryKey, weather, activities) {
  if (categoryKey === "tops" && (weather.weatherCategory === "hot" || weather.weatherCategory === "warm")) return "Breathable tops";
  if (categoryKey === "tops") return "Layerable tops";
  if (categoryKey === "bottoms" && (weather.weatherCategory === "hot" || weather.weatherCategory === "warm")) return "Light bottoms";
  if (categoryKey === "bottoms") return "Versatile bottoms";
  if (categoryKey === "outerwear" && (weather.peakRainChance || 0) >= 45) return "Rain layer";
  if (categoryKey === "outerwear") return "Outer layer";
  if (categoryKey === "shoes" && activities.some((activity) => activity.toLowerCase().includes("hiking"))) return "Comfortable walking shoes";
  if (categoryKey === "shoes") return "Trip-ready shoes";
  if (categoryKey === "accessories" && weather.weatherCategory === "hot") return "Sun accessory";
  if (categoryKey === "accessories") return "Small accessories";
  return titleCase(categoryKey);
}

function buildWardrobeBackedItems({ wardrobe, categoryKey, quantity, weather, tripPurpose, activities }) {
  const owned = (Array.isArray(wardrobe) ? wardrobe : [])
    .filter((item) => item && item.is_active !== false)
    .filter((item) => categoryKeyFromItem(item) === categoryKey)
    .sort((a, b) => scoreWardrobeItem(b, categoryKey, weather, tripPurpose, activities) - scoreWardrobeItem(a, categoryKey, weather, tripPurpose, activities));

  if (!quantity) return [];

  if (!owned.length) {
    return [{
      item_id: makeId(),
      name: fallbackName(categoryKey, weather, activities),
      quantity,
      category: CATEGORY_LABELS[categoryKey] || titleCase(categoryKey),
      image_url: "",
      owned: false,
      packed: false,
      note: "General suggestion",
    }];
  }

  const uniqueOwned = owned.slice(0, Math.min(quantity, 3));
  const distribution = distributeQuantity(quantity, uniqueOwned.length);
  const rows = uniqueOwned.map((item, index) => ({
    item_id: (item?.id ?? makeId()).toString(),
    name: item?.name || "Wardrobe item",
    quantity: distribution[index] || 1,
    category: item?.category || CATEGORY_LABELS[categoryKey] || "Item",
    image_url: item?.image_url || "",
    owned: true,
    packed: false,
    note: "From your wardrobe",
  }));

  const currentQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (currentQuantity < quantity) {
    rows.push({
      item_id: makeId(),
      name: fallbackName(categoryKey, weather, activities),
      quantity: quantity - currentQuantity,
      category: CATEGORY_LABELS[categoryKey] || titleCase(categoryKey),
      image_url: "",
      owned: false,
      packed: false,
      note: "Fill with another similar piece",
    });
  }

  return rows;
}

function buildEssentialItems(quantities) {
  return [
    { item_id: makeId(), name: "Underwear", quantity: quantities.underwear, category: "Essentials", image_url: "", owned: false, packed: false, note: "Daily base layers" },
    { item_id: makeId(), name: "Socks", quantity: quantities.socks, category: "Essentials", image_url: "", owned: false, packed: false, note: "Daily wear" },
    { item_id: makeId(), name: "Sleepwear", quantity: quantities.sleepwear, category: "Essentials", image_url: "", owned: false, packed: false, note: "Night routine" },
  ];
}

function buildSpecialtyItems(template, weather) {
  return template.specialty.map((item) => ({
    item_id: makeId(),
    name: item.label,
    quantity: item.quantity,
    category: "Specialty",
    image_url: "",
    owned: false,
    packed: false,
    note: weather.peakRainChance >= 45 ? "Suggested by the forecast" : "Suggested by your trip activities",
  }));
}

export function createCustomPackingItem({ name, category, quantity }) {
  return {
    item_id: makeId(),
    name: (name || "").toString().trim() || "Custom item",
    quantity: Math.max(1, Number(quantity) || 1),
    category: category || "Custom",
    image_url: "",
    owned: false,
    packed: false,
    note: "Custom item",
  };
}

export function generateTripPackingPlan({
  wardrobe,
  destination,
  destinationLabel,
  startDate,
  endDate,
  luggageMode = "carry-on",
  tripPurpose = "",
  activities = [],
  forecast,
  answers,
  seedNumber,
}) {
  const durationDays = tripDurationDays(startDate, endDate);
  const tripDays = buildTripDateRange(startDate, endDate);
  const forecastDays = Array.isArray(forecast?.days) ? forecast.days : [];
  const weather = tripWeatherSummary(forecastDays);
  const template = quantityTemplate({
    durationDays,
    weather,
    luggageMode,
    activities,
  });

  const packingGroups = [
    {
      key: "tops",
      label: "Tops",
      summary: "Everyday rotation pieces",
      totalQuantity: template.tops,
      items: buildWardrobeBackedItems({ wardrobe, categoryKey: "tops", quantity: template.tops, weather, tripPurpose, activities }),
    },
    {
      key: "bottoms",
      label: "Bottoms",
      summary: "Repeat-friendly foundations",
      totalQuantity: template.bottoms,
      items: buildWardrobeBackedItems({ wardrobe, categoryKey: "bottoms", quantity: template.bottoms, weather, tripPurpose, activities }),
    },
    {
      key: "outerwear",
      label: "Outerwear",
      summary: "Layers for forecast swings",
      totalQuantity: template.outerwear,
      items: buildWardrobeBackedItems({ wardrobe, categoryKey: "outerwear", quantity: template.outerwear, weather, tripPurpose, activities }),
    },
    {
      key: "shoes",
      label: "Shoes",
      summary: "Pairs that can cover the whole trip",
      totalQuantity: template.shoes,
      items: buildWardrobeBackedItems({ wardrobe, categoryKey: "shoes", quantity: template.shoes, weather, tripPurpose, activities }),
    },
    {
      key: "accessories",
      label: "Accessories",
      summary: "Small extras that help with comfort",
      totalQuantity: template.accessories,
      items: buildWardrobeBackedItems({ wardrobe, categoryKey: "accessories", quantity: template.accessories, weather, tripPurpose, activities }),
    },
    {
      key: "essentials",
      label: "Essentials",
      summary: "Base layers and sleepwear",
      totalQuantity: template.essentials.underwear + template.essentials.socks + template.essentials.sleepwear,
      items: buildEssentialItems(template.essentials),
    },
  ].filter((group) => group.totalQuantity > 0);

  if (template.specialty.length) {
    packingGroups.push({
      key: "specialty",
      label: "Specialty",
      summary: "Trip-specific extras",
      totalQuantity: template.specialty.reduce((sum, item) => sum + item.quantity, 0),
      items: buildSpecialtyItems(template, weather),
    });
  }

  const totalItemCount = packingGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + (Number(item.quantity) || 0), 0), 0);
  const weatherLabel = forecast?.status === "ok"
    ? `${titleCase(weather.weatherCategory)} weather expected`
    : "Weather unavailable";

  const outfitPlan = (() => {
    const baseSeed = Number.isFinite(Number(seedNumber)) ? Number(seedNumber) : Date.now();
    const bodyTypeId = answers?.bodyType || DEFAULT_BODY_TYPE;

    if (forecast?.status === "ok" && forecastDays.length) {
      return buildForecastSuggestions({
        wardrobe,
        forecastDays,
        seedNumber: baseSeed,
        bodyTypeId,
        answers,
      });
    }

    return tripDays.map((date, index) => {
      const suggestion = buildFallbackPlanningSuggestion({
        wardrobe,
        seedNumber: baseSeed + index * 53,
        bodyTypeId,
        answers,
      });

      return {
        date,
        title: "Flexible travel outfit",
        summary: "General travel suggestion",
        weatherCategory: suggestion.weatherCategory,
        outfit: suggestion.outfit,
        score: suggestion.score || 0,
        note: suggestion.note,
      };
    });
  })();

  return {
    packing_groups: packingGroups,
    outfit_plan: outfitPlan,
    summary: {
      destination: destinationLabel || destination,
      durationDays,
      totalItemCount,
      weatherLabel,
      highestTempF: weather.highestTempF,
      lowestTempF: weather.lowestTempF,
      peakRainChance: weather.peakRainChance,
      tripDates: tripDays,
    },
  };
}
