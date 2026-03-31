
import { normalizeFitTag, normalizeItems, idsSignature } from "./helpers";

const DEFAULT_BODY_TYPE = "rectangle";


export function titleCase(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function normalizeCategory(cat) {
  const c = (cat || "").toString().trim().toLowerCase();
  if (!c) return "";
  if (c === "tops" || c === "top") return "Tops";
  if (c === "bottoms" || c === "bottom") return "Bottoms";
  if (c === "outerwear" || c === "jacket" || c === "coats") return "Outerwear";
  if (c === "shoes" || c === "shoe") return "Shoes";
  if (c === "accessories" || c === "accessory") return "Accessories";
  return titleCase(c);
}

export function normalizeColorName(raw) {
  if (!raw) return "";
  const t = raw.toString().trim().toLowerCase();

  const map = {
    "off white": "white",
    ivory: "white",
    cream: "beige",
    tan: "beige",
    khaki: "beige",
    "navy blue": "navy",
    "dark blue": "navy",
    "light blue": "blue",
    "forest green": "green",
    olive: "green",
    mint: "green",
    "hot pink": "pink",
    rose: "pink",
    burgundy: "red",
    maroon: "red",
    wine: "red",
    charcoal: "gray",
    silver: "gray",
    denim: "navy",
  };

  return map[t] || t;
}

const CSS_COLOR_MAP = {
  black: "#1a1a1a", white: "#f5f5f5", gray: "#9ca3af", grey: "#9ca3af",
  red: "#dc2626", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308",
  orange: "#f97316", purple: "#a855f7", pink: "#ec4899", brown: "#92400e",
  beige: "#d4c5a9", navy: "#1e3a5f", teal: "#14b8a6", coral: "#f87171",
  gold: "#d97706", olive: "#65a30d", lavender: "#a78bfa", mint: "#34d399",
};

export function splitColors(raw) {
  if (!raw) return [];
  return raw.split(",").map((c) => c.trim()).filter(Boolean);
}

export function colorToCss(colorName) {
  const parts = splitColors(colorName);
  if (parts.length <= 1) {
    const c = normalizeColorName(colorName).toLowerCase();
    return CSS_COLOR_MAP[c] || "#9ca3af";
  }
  const hexes = parts.map((p) => CSS_COLOR_MAP[normalizeColorName(p).toLowerCase()] || "#9ca3af");
  const stops = hexes.map((h, i) => `${h} ${Math.round((i / (hexes.length - 1)) * 100)}%`).join(", ");
  return `linear-gradient(135deg, ${stops})`;
}



function normalizeDashboardFit(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v || v === "unknown") return "unspecified";
  const map = { slim: "fitted", tailored: "fitted", athletic: "fitted", petite: "fitted", plus: "relaxed" };
  if (map[v]) return map[v];
  const allowed = new Set(["unspecified", "tight", "fitted", "regular", "relaxed", "oversized"]);
  return allowed.has(v) ? v : "unspecified";
}

export function fitPenalty(fitTag, bodyTypeId, category) {
  const fit = normalizeDashboardFit(fitTag);
  const body = (bodyTypeId || DEFAULT_BODY_TYPE).toString().trim().toLowerCase();

  if (fit === "unspecified") return 0;

  if (body === "apple") {
    if (fit === "tight") return 3;
    if (fit === "fitted" && category === "Tops") return 1;
    return 0;
  }

  if (body === "pear") {
    if (category === "Tops" && fit === "oversized") return 2;
    if (category === "Bottoms" && fit === "tight") return 1;
    return 0;
  }

  if (body === "inverted") {
    if (category === "Tops" && fit === "tight") return 2;
    if (category === "Bottoms" && fit === "oversized") return 1;
    return 0;
  }

  if (body === "hourglass") {
    if (fit === "oversized") return 1;
    return 0;
  }

  return 0;
}



const COLOR_HUE_MAP = {
  red: 0, coral: 16, orange: 30, gold: 43, yellow: 55,
  olive: 80, green: 130, mint: 155, teal: 175, turquoise: 180,
  blue: 220, navy: 225, purple: 275, lavender: 265, pink: 335, peach: 20,
};

const NEUTRAL_COLORS = new Set([
  "black", "white", "gray", "grey", "beige", "tan", "cream", "brown", "denim",
]);

export function colorInfo(colorRaw) {
  const c = normalizeColorName(colorRaw);
  if (!c) return { hue: -1, neutral: false, name: "" };
  if (NEUTRAL_COLORS.has(c)) return { hue: -1, neutral: true, name: c };
  const hue = COLOR_HUE_MAP[c];
  if (hue !== undefined) return { hue, neutral: false, name: c };
  return { hue: -1, neutral: false, name: c };
}

export function hueDiff(h1, h2) {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

function singlePairScore(a, b) {
  if (!a.name || !b.name) return 2;

  if (a.neutral && b.neutral) {
    return a.name === b.name ? 3 : 4;
  }

  if (a.neutral || b.neutral) {
    const neutral = a.neutral ? a.name : b.name;
    const darkNeutrals = new Set(["black", "navy", "brown", "gray", "grey", "denim"]);
    return darkNeutrals.has(neutral) ? 4 : 3;
  }

  if (a.hue < 0 || b.hue < 0) return 2;

  const diff = hueDiff(a.hue, b.hue);

  if (diff <= 15) return a.name === b.name ? 2 : 4;
  if (diff <= 40) return 4;
  if (diff >= 150 && diff <= 210) return 5;
  if (diff >= 100 && diff <= 140) return 3;
  if (diff >= 130 && diff <= 160) return 3;
  if (diff >= 50 && diff <= 100) return 1;

  return 2;
}

export function pairScore(aColor, bColor) {
  const aParts = splitColors(aColor);
  const bParts = splitColors(bColor);
  const aInfos = (aParts.length ? aParts : [aColor]).map(colorInfo);
  const bInfos = (bParts.length ? bParts : [bColor]).map(colorInfo);

  let total = 0;
  let count = 0;
  for (const a of aInfos) {
    for (const b of bInfos) {
      total += singlePairScore(a, b);
      count++;
    }
  }
  return count > 0 ? total / count : 2;
}



export function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne(list, rng) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const idx = Math.floor(rng() * list.length);
  return list[idx];
}

function pickBestByScore(candidates, scoreFn, rng) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    const s = scoreFn(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    } else if (s === bestScore && rng() > 0.5) {
      best = c;
    }
  }

  return best || pickOne(candidates, rng);
}



export function weatherCategoryFromTempF(tempF) {
  const t = Number(tempF);
  if (!Number.isFinite(t)) return "mild";
  if (t <= 40) return "cold";
  if (t >= 41 && t <= 55) return "cool";
  if (t >= 56 && t <= 70) return "mild";
  if (t >= 71 && t <= 85) return "warm";
  return "hot";
}

function weatherScoreBias(category, itemCategory) {
  const cat = (category || "mild").toString().toLowerCase();
  const c = normalizeCategory(itemCategory);

  if (cat === "cold" || cat === "cool") {
    if (c === "Outerwear") return 6;
    if (c === "Bottoms") return 2;
    if (c === "Shoes") return 1;
    return 0;
  }

  if (cat === "warm" || cat === "hot") {
    if (c === "Outerwear") return -8;
    if (c === "Bottoms") return 0;
    if (c === "Shoes") return 0;
    return 1;
  }

  return 0;
}



export function timeCategoryFromDate(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date();
  const h = d.getHours();

  if (!Number.isFinite(h)) return "work hours";

  if (h >= 5 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "work hours";
  if (h >= 18 && h <= 21) return "evening";
  return "night";
}

function hasOccasionSelected(answers) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  return dressFor.length > 0;
}

function timeScoreBias(timeCatRaw, itemCategory, answers) {
  const timeCat = (timeCatRaw || "work hours").toString().trim().toLowerCase();
  const c = normalizeCategory(itemCategory);

  const occasionSelected = hasOccasionSelected(answers);
  const strength = occasionSelected ? 0.6 : 1;

  const base = (() => {
    if (timeCat === "morning") {
      if (c === "Outerwear") return 2;
      if (c === "Bottoms") return 1;
      if (c === "Accessories") return -1;
      return 0;
    }

    if (timeCat === "work hours") {
      if (c === "Outerwear") return 3;
      if (c === "Shoes") return 1;
      if (c === "Accessories") return -1;
      return 0;
    }

    if (timeCat === "evening") {
      if (c === "Accessories") return 2;
      if (c === "Outerwear") return 1;
      return 0;
    }

    if (c === "Outerwear") return -2;
    if (c === "Accessories") return -1;
    return 1;
  })();

  return Math.round(base * strength);
}



function bestMatch(outfitSoFar, candidates, rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers) {
  if (!outfitSoFar || !outfitSoFar.length) return pickOne(candidates, rng);
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const scoreFn = (c) => {
    let colorTotal = 0;
    for (const item of outfitSoFar) {
      colorTotal += pairScore(item?.color, c?.color);
    }
    const colorAvg = colorTotal / outfitSoFar.length;

    const pen = fitPenalty(c?.fit_tag, bodyTypeId, c?.category);

    const id = (c?.id ?? "").toString().trim();
    const freq = id && recentItemCounts ? recentItemCounts.get(id) || 0 : 0;

    const wBias = weatherScoreBias(weatherCat, c?.category);
    const tBias = timeScoreBias(timeCat, c?.category, answers);

    return colorAvg * 12 - pen - freq * 2 + wBias + tBias;
  };

  return pickBestByScore(candidates, scoreFn, rng);
}

function normalizeTagArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry ?? "").toString().trim().toLowerCase())
      .filter(Boolean)
      .filter((entry, idx, arr) => arr.indexOf(entry) === idx);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .filter((entry, idx, arr) => arr.indexOf(entry) === idx);
  }

  return [];
}

function normalizeClothingType(value) {
  return (value || "").toString().trim().toLowerCase();
}

function normalizeLayerType(value, clothingType, category) {
  const raw = (value || "").toString().trim().toLowerCase();
  if (raw === "base" || raw === "mid" || raw === "outer") return raw;

  const type = normalizeClothingType(clothingType);
  const cat = normalizeCategory(category);
  if (["t-shirt", "tank top", "long sleeve", "blouse", "dress shirt", "polo", "camisole", "henley"].includes(type)) return "base";
  if (["hoodie", "sweater", "cardigan", "fleece", "vest", "pullover", "turtleneck", "sweatshirt"].includes(type)) return "mid";
  if (["jacket", "coat", "blazer", "parka", "windbreaker", "overcoat", "trench coat", "raincoat", "anorak", "duster"].includes(type)) return "outer";
  if (cat === "Outerwear") return "outer";
  return "";
}

/* ── Layering warmth system ──────────────────────────────────────────── */

const LAYER_WARMTH = {
  "tank top": 1, camisole: 1, "crop top": 1,
  "t-shirt": 2, polo: 2, blouse: 2, henley: 2,
  "dress shirt": 3, "long sleeve": 3,
  turtleneck: 4, sweater: 5, hoodie: 5, sweatshirt: 5, fleece: 5,
  cardigan: 4, pullover: 5, vest: 3,
  blazer: 4, "light jacket": 4, windbreaker: 4, "denim jacket": 4,
  jacket: 5, "leather jacket": 5, raincoat: 4,
  coat: 7, overcoat: 7, parka: 8, "trench coat": 6, anorak: 6, "down jacket": 8, "puffer jacket": 8, duster: 5,
  shorts: -1, sandals: -1,
};

export function layerWarmth(item) {
  const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
  if (LAYER_WARMTH[type] !== undefined) return LAYER_WARMTH[type];
  const layer = item?.layer_type || normalizeLayerType(undefined, type, item?.category);
  if (layer === "outer") return 5;
  if (layer === "mid") return 4;
  if (layer === "base") return 2;
  return 1;
}

function outfitTotalWarmth(outfit) {
  return (Array.isArray(outfit) ? outfit : [])
    .filter((item) => itemRole(item) !== "accessory" && itemRole(item) !== "shoes")
    .reduce((sum, item) => sum + layerWarmth(item), 0);
}

function warmthTarget(weatherCat) {
  const cat = (weatherCat || "mild").toString().trim().toLowerCase();
  if (cat === "cold") return { min: 10, ideal: 14, max: 20 };
  if (cat === "cool") return { min: 6, ideal: 9, max: 14 };
  if (cat === "mild") return { min: 3, ideal: 6, max: 10 };
  if (cat === "warm") return { min: 1, ideal: 3, max: 6 };
  /* hot */ return { min: 1, ideal: 2, max: 4 };
}

function warmthScore(outfit, weatherCat) {
  const total = outfitTotalWarmth(outfit);
  const target = warmthTarget(weatherCat);
  if (total >= target.min && total <= target.max) {
    const dist = Math.abs(total - target.ideal);
    return Math.max(0, 8 - dist * 2);
  }
  if (total < target.min) return -(target.min - total) * 3;
  return -(total - target.max) * 3;
}

function normalizeSetId(value) {
  return (value || "").toString().trim().toLowerCase();
}

function seasonFromDate(dateObj) {
  const month = (dateObj instanceof Date ? dateObj : new Date()).getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

function targetLayersForWeather(weatherCat) {
  const cat = (weatherCat || "mild").toString().trim().toLowerCase();
  if (cat === "cold" || cat === "cool") return ["base", "mid", "outer"];
  return ["base"];
}

function accessoryLimitForWeather(weatherCat) {
  const cat = (weatherCat || "mild").toString().trim().toLowerCase();
  if (cat === "hot") return 1;
  if (cat === "warm") return 2;
  return 2;
}

function isAccessoryType(type) {
  return ["hat", "scarf", "watch", "belt", "jewelry", "jewellery", "sunglasses", "bag"].includes(type);
}

function accessoryFamily(item) {
  const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
  if (type.includes("hat")) return "hat";
  if (type.includes("scarf")) return "scarf";
  if (type.includes("watch")) return "watch";
  if (type.includes("belt")) return "belt";
  if (type.includes("glass")) return "eyewear";
  if (type.includes("jewel") || type.includes("necklace") || type.includes("bracelet") || type.includes("ring")) return "jewelry";
  if (type.includes("bag") || type.includes("purse")) return "bag";
  return type || "accessory";
}

function normalizeOccasionValue(value) {
  const raw = (value || "").toString().trim().toLowerCase();
  if (!raw) return "";
  const map = {
    work: "work",
    office: "work",
    formal: "formal",
    athletic: "athletic",
    activewear: "athletic",
    active: "athletic",
    casual: "casual",
    social: "social",
    lounge: "relaxed",
    relaxed: "relaxed",
    everyday: "casual",
    daily: "casual",
  };
  return map[raw] || raw;
}

function normalizeStyleValue(value) {
  const raw = (value || "").toString().trim().toLowerCase();
  if (!raw) return "";
  const map = {
    activewear: "activewear",
    athletic: "activewear",
    relaxed: "relaxed",
    lounge: "relaxed",
    formal: "formal",
    casual: "casual",
    smartcasual: "smart casual",
    "smart casual": "smart casual",
    work: "formal",
  };
  return map[raw] || raw;
}

function preferredOccasionsFromAnswers(answers) {
  return normalizeTagArray(answers?.dressFor).map(normalizeOccasionValue).filter(Boolean);
}

function preferredStylesFromAnswers(answers) {
  return normalizeTagArray(answers?.style).map(normalizeStyleValue).filter(Boolean);
}

function itemWeatherProfile(item) {
  const type = normalizeClothingType(item?.clothing_type);
  const cat = normalizeCategory(item?.category);

  if (["coat", "parka"].includes(type)) return { warm: 3, coolness: 0 };
  if (["jacket", "blazer", "hoodie", "sweater", "cardigan", "boots"].includes(type) || cat === "Outerwear") {
    return { warm: 2, coolness: 0 };
  }
  if (["shorts", "tank top", "sandals"].includes(type)) return { warm: 0, coolness: 3 };
  if (["t-shirt", "skirt"].includes(type)) return { warm: 1, coolness: 2 };
  return { warm: 1, coolness: 1 };
}

function clothingTypeBias(item, weatherCat) {
  const profile = itemWeatherProfile(item);
  const cat = (weatherCat || "mild").toString().trim().toLowerCase();
  if (cat === "cold") return profile.warm * 4 - profile.coolness * 3;
  if (cat === "cool") return profile.warm * 3 - profile.coolness * 2;
  if (cat === "warm") return profile.coolness * 3 - profile.warm * 2;
  if (cat === "hot") return profile.coolness * 4 - profile.warm * 4;
  return profile.coolness + profile.warm;
}

function metadataScore(item, context) {
  const { answers, weatherCat, bodyTypeId, recentItemCounts, timeCat, outfitSoFar, selectedSeason } = context;
  const id = (item?.id ?? "").toString().trim();
  const recentPenalty = id && recentItemCounts ? (recentItemCounts.get(id) || 0) * 2 : 0;

  const styles = normalizeTagArray(item?.style_tags).map(normalizeStyleValue);
  const occasions = normalizeTagArray(item?.occasion_tags).map(normalizeOccasionValue);
  const seasons = normalizeTagArray(item?.season_tags);
  const preferredStyles = preferredStylesFromAnswers(answers);
  const preferredOccasions = preferredOccasionsFromAnswers(answers);

  let score = 0;

  if (preferredStyles.length) {
    score += styles.some((style) => preferredStyles.includes(style)) ? 10 : styles.length ? -5 : 2;
  } else if (styles.includes("casual")) {
    score += 2;
  }

  if (preferredOccasions.length) {
    score += occasions.some((occasion) => preferredOccasions.includes(occasion)) ? 12 : occasions.length ? -6 : 2;
  }

  if (seasons.length) {
    score += seasons.includes(selectedSeason) ? 8 : -4;
  } else {
    score += 1;
  }

  score += weatherScoreBias(weatherCat, item?.category);
  score += timeScoreBias(timeCat, item?.category, answers);
  score += clothingTypeBias(item, weatherCat);
  score -= fitPenalty(item?.fit_tag, bodyTypeId, item?.category);
  score -= recentPenalty;

  if (Array.isArray(outfitSoFar) && outfitSoFar.length) {
    const colorScore = outfitSoFar.reduce((total, existing) => total + pairScore(existing?.color, item?.color), 0) / outfitSoFar.length;
    score += colorScore * 8;
  }

  return score;
}

const ONE_PIECE_TYPES = new Set([
  "dress", "jumpsuit", "romper", "overalls", "onesie", "bodysuit",
  "maxi dress", "midi dress", "mini dress", "wrap dress", "shirt dress",
  "sundress", "gown", "coveralls", "playsuit", "catsuit", "unitard",
]);

function isOnePiece(flag, clothingType) {
  if (flag === true || String(flag).toLowerCase() === "true") return true;
  const type = normalizeClothingType(clothingType);
  return ONE_PIECE_TYPES.has(type);
}

function createNormalizedItem(x, idx) {
  const category = normalizeCategory(x?.category);
  const type = normalizeClothingType(x?.clothing_type || x?.type || "");
  const layerType = normalizeLayerType(x?.layer_type, type, category);
  const styles = normalizeTagArray(x?.style_tags).map(normalizeStyleValue);
  const occasions = normalizeTagArray(x?.occasion_tags).map(normalizeOccasionValue);
  const seasons = normalizeTagArray(x?.season_tags);

  return {
    ...x,
    _idx: idx,
    category,
    color: titleCase(normalizeColorName(x?.color || "")),
    name: x?.name || "Wardrobe item",
    fit_tag: normalizeFitTag(x?.fit_tag || x?.fitTag || x?.fit),
    clothing_type: type,
    layer_type: layerType,
    style_tags: styles,
    occasion_tags: occasions,
    season_tags: seasons,
    set_id: normalizeSetId(x?.set_id),
    is_one_piece: isOnePiece(x?.is_one_piece, type),
  };
}

function itemRole(item) {
  if (!item) return "other";
  if (item.is_one_piece) return "one-piece";
  const cat = normalizeCategory(item.category);
  if (cat === "Tops") return "top";
  if (cat === "Bottoms") return "bottom";
  if (cat === "Shoes") return "shoes";
  if (cat === "Outerwear") return "outerwear";
  if (cat === "Accessories") return "accessory";
  return "other";
}

function itemsConflict(a, b) {
  if (!a || !b) return false;
  const roleA = itemRole(a);
  const roleB = itemRole(b);
  if (roleA === roleB && roleA !== "accessory") return true;

  /* One-piece covers top + bottom — conflicts with standalone tops and bottoms */
  if (roleA === "one-piece" && (roleB === "top" || roleB === "bottom")) return true;
  if (roleB === "one-piece" && (roleA === "top" || roleA === "bottom")) return true;

  const typeA = normalizeClothingType(a.clothing_type || a.name);
  const typeB = normalizeClothingType(b.clothing_type || b.name);

  if (a.layer_type && b.layer_type && a.layer_type === b.layer_type && a.layer_type !== "base") return true;
  if (["coat", "parka", "overcoat", "down jacket", "puffer jacket"].includes(typeA) && ["coat", "parka", "overcoat", "down jacket", "puffer jacket"].includes(typeB)) return true;
  if (["hoodie", "sweater", "cardigan", "fleece", "pullover", "sweatshirt"].includes(typeA) && ["hoodie", "sweater", "cardigan", "fleece", "pullover", "sweatshirt"].includes(typeB)) return true;

  const athleticShorts = ["gym shorts", "athletic shorts", "running shorts"];
  if ((typeA === "blazer" && athleticShorts.includes(typeB)) || (typeB === "blazer" && athleticShorts.includes(typeA))) return true;
  if ((typeA === "dress shoes" && athleticShorts.includes(typeB)) || (typeB === "dress shoes" && athleticShorts.includes(typeA))) return true;

  /* Layering realism: lightweight base under heavy outer needs a mid */
  const lightBase = ["tank top", "camisole", "crop top"];
  const heavyOuter = ["parka", "overcoat", "down jacket", "puffer jacket"];
  if ((lightBase.includes(typeA) && heavyOuter.includes(typeB)) || (lightBase.includes(typeB) && heavyOuter.includes(typeA))) return true;

  return false;
}

function withUniqueById(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((item) => {
    const id = (item?.id ?? "").toString();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}



export function bucketWardrobe(activeItems) {
  const pool = (Array.isArray(activeItems) ? activeItems : []).map(createNormalizedItem);

  const byCat = {
    Tops: [],
    Bottoms: [],
    Shoes: [],
    Outerwear: [],
    Accessories: [],
    OnePieces: [],
    Other: [],
  };

  for (const item of pool) {
    if (item.is_one_piece) byCat.OnePieces.push(item);
    if (item.category === "Tops") byCat.Tops.push(item);
    else if (item.category === "Bottoms") byCat.Bottoms.push(item);
    else if (item.category === "Shoes") byCat.Shoes.push(item);
    else if (item.category === "Outerwear") byCat.Outerwear.push(item);
    else if (item.category === "Accessories" || isAccessoryType(item.clothing_type)) byCat.Accessories.push(item);
    else byCat.Other.push(item);
  }

  return byCat;
}


export function defaultOutfitSet(seedNumber) {
  const seed = typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const rng = mulberry32(seed);

  const altShoes = [
    { id: "d4a", name: "Black Oxfords", color: "Black", category: "Shoes" },
    { id: "d4b", name: "White Sneakers", color: "White", category: "Shoes" },
    { id: "d4c", name: "Nude Flats", color: "Beige", category: "Shoes" },
  ];

  const altBottoms = [
    { id: "d3a", name: "Gray Trousers", color: "Gray", category: "Bottoms" },
    { id: "d3b", name: "Black Jeans", color: "Black", category: "Bottoms" },
    { id: "d3c", name: "Navy Skirt", color: "Navy", category: "Bottoms" },
  ];

  const altTops = [
    { id: "d2a", name: "White Button-Up", color: "White", category: "Tops" },
    { id: "d2b", name: "Cream Knit Top", color: "Beige", category: "Tops" },
    { id: "d2c", name: "Black Turtleneck", color: "Black", category: "Tops" },
  ];

  const outer = { id: "d1", name: "Navy Blazer", color: "Navy", category: "Outerwear" };

  const make = () => {
    const top = pickOne(altTops, rng);
    const bottom = bestMatch([top], altBottoms, rng, DEFAULT_BODY_TYPE, null, "mild", "work hours", null);
    const shoes = bestMatch([bottom || top], altShoes, rng, DEFAULT_BODY_TYPE, null, "mild", "work hours", null);

    return [outer, top, bottom, shoes].map((x, i) => ({
      id: x.id ?? `df_${i}`,
      name: x.name,
      category: normalizeCategory(x.category),
      color: titleCase(x.color || ""),
      fit_tag: "unspecified",
      image_url: x.image_url || "",
    }));
  };

  return [make(), make(), make()];
}



function sortCandidates(candidates, context, outfitSoFar, rng) {
  return withUniqueById(candidates)
    .map((item) => ({
      item,
      score: metadataScore(item, { ...context, outfitSoFar }),
      tie: rng(),
    }))
    .sort((a, b) => (b.score - a.score) || (a.tie - b.tie))
    .map((entry) => entry.item);
}

function findAllSetPartners(item, allPools) {
  const setId = normalizeSetId(item?.set_id);
  if (!setId) return [];
  const partners = [];
  const seenIds = new Set([(item?.id ?? "").toString()]);
  for (const pool of allPools) {
    for (const candidate of Array.isArray(pool) ? pool : []) {
      const cId = (candidate?.id ?? "").toString();
      if (seenIds.has(cId)) continue;
      if (normalizeSetId(candidate?.set_id) === setId) {
        partners.push(candidate);
        seenIds.add(cId);
      }
    }
  }
  return partners;
}

function chooseFirstCompatible(candidates, outfitSoFar) {
  return (Array.isArray(candidates) ? candidates : []).find((candidate) => !outfitSoFar.some((existing) => itemsConflict(existing, candidate))) || null;
}

function buildOutfitCandidate(buckets, rng, context, variant) {
  const outfit = [];
  const roleCounts = new Map();
  const layerTargets = targetLayersForWeather(context.weatherCat);
  const selectedLayerTypes = new Set();

  const addItem = (item) => {
    if (!item) return false;
    if (outfit.some((existing) => (existing?.id ?? "") === (item?.id ?? ""))) return false;
    if (outfit.some((existing) => itemsConflict(existing, item))) return false;

    const role = itemRole(item);
    if (role !== "accessory" && role !== "outerwear" && role !== "other") {
      if ((roleCounts.get(role) || 0) >= 1) return false;
    }
    if (item.layer_type && selectedLayerTypes.has(item.layer_type) && item.layer_type !== "base") return false;

    outfit.push(item);
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    /* One-piece fills both top and bottom roles */
    if (role === "one-piece") {
      roleCounts.set("top", (roleCounts.get("top") || 0) + 1);
      roleCounts.set("bottom", (roleCounts.get("bottom") || 0) + 1);
    }
    if (item.layer_type) selectedLayerTypes.add(item.layer_type);
    return true;
  };

  const onePieceCandidates = sortCandidates(buckets.OnePieces, context, outfit, rng);
  const topCandidates = sortCandidates(buckets.Tops, context, outfit, rng);
  const bottomCandidates = sortCandidates(buckets.Bottoms, context, outfit, rng);
  const shoeCandidates = sortCandidates(buckets.Shoes, context, outfit, rng);
  const outerCandidates = sortCandidates(buckets.Outerwear, context, outfit, rng);
  const accessoryCandidates = sortCandidates([...buckets.Accessories, ...buckets.Other], context, outfit, rng);

  const allPools = [topCandidates, bottomCandidates, outerCandidates, shoeCandidates, accessoryCandidates, onePieceCandidates];
  const preferOnePiece = variant % 3 === 1 || (onePieceCandidates.length > 0 && topCandidates.length < 2);

  if (preferOnePiece) {
    const picked = chooseFirstCompatible(onePieceCandidates, outfit);
    if (addItem(picked)) {
      /* Try to add all set partners of the one-piece across every category */
      for (const partner of findAllSetPartners(picked, allPools)) {
        addItem(partner);
      }
    }
  }

  const hasOnePiece = outfit.some((item) => itemRole(item) === "one-piece");

  if (!hasOnePiece) {
    const baseLayerTopCandidates = topCandidates.filter((item) => {
      if (!item.layer_type) return true;
      return layerTargets.includes(item.layer_type) || item.layer_type === "base";
    });
    const topPool = baseLayerTopCandidates.length ? baseLayerTopCandidates : topCandidates;

    /* For some variants, prefer tops that have set partners available */
    let firstTop = null;
    if (variant % 4 === 0) {
      const setTops = topPool.filter((item) => normalizeSetId(item?.set_id) && findAllSetPartners(item, allPools).length > 0);
      firstTop = chooseFirstCompatible(setTops, outfit);
    }
    if (!firstTop) firstTop = chooseFirstCompatible(topPool, outfit);

    if (addItem(firstTop)) {
      /* Try set partners across ALL categories, not just bottoms */
      for (const partner of findAllSetPartners(firstTop, allPools)) {
        addItem(partner);
      }
    }

    if (!(roleCounts.get("bottom") || 0)) {
      /* For some variants, prefer bottoms with set partners */
      let firstBottom = null;
      if (variant % 4 === 0) {
        const setBots = bottomCandidates.filter((item) => normalizeSetId(item?.set_id) && findAllSetPartners(item, allPools).length > 0);
        firstBottom = chooseFirstCompatible(setBots, outfit);
      }
      if (!firstBottom) firstBottom = chooseFirstCompatible(bottomCandidates, outfit);

      if (addItem(firstBottom)) {
        /* Bottom may also have set partners (e.g. matching shoes or accessories) */
        for (const partner of findAllSetPartners(firstBottom, allPools)) {
          addItem(partner);
        }
      }
    }
  }

  /* ── Layering: mid-layer selection ────────────────────────────────── */
  const wCat = (context.weatherCat || "mild").toString().trim().toLowerCase();
  const needsMid = layerTargets.includes("mid");
  const hasTop = (roleCounts.get("top") || 0) > 0;

  if (needsMid && hasTop) {
    /* cold: always try mid-layer; cool: most variants get one */
    const tryMid = wCat === "cold" || (wCat === "cool" && variant % 3 !== 2);
    if (tryMid) {
      const midPool = topCandidates.filter((item) => item.layer_type === "mid");
      /* rank mid-layers by warmth for cold weather */
      const sortedMid = wCat === "cold"
        ? [...midPool].sort((a, b) => layerWarmth(b) - layerWarmth(a))
        : midPool;
      addItem(chooseFirstCompatible(sortedMid, outfit));
    }
  }

  /* ── Layering: outer-layer selection ────────────────────────────── */
  const needsOuter = layerTargets.includes("outer") || (wCat === "cool" && variant % 3 !== 2);
  /* warm/hot: skip outerwear entirely */
  const skipOuter = wCat === "warm" || wCat === "hot";

  if (needsOuter && !skipOuter) {
    const preferredOuter = outerCandidates.filter((item) => !item.layer_type || item.layer_type === "outer");
    /* cold weather: prefer heavier outerwear */
    const sortedOuter = wCat === "cold"
      ? [...(preferredOuter.length ? preferredOuter : outerCandidates)].sort((a, b) => layerWarmth(b) - layerWarmth(a))
      : preferredOuter.length ? preferredOuter : outerCandidates;
    addItem(chooseFirstCompatible(sortedOuter, outfit));
  }

  const shoeContext = outfit.filter((item) => ["one-piece", "top", "bottom", "outerwear"].includes(itemRole(item)));
  const rankedShoes = sortCandidates(shoeCandidates, context, shoeContext.length ? shoeContext : outfit, rng);
  addItem(chooseFirstCompatible(rankedShoes, outfit));

  const accessoryLimit = accessoryLimitForWeather(context.weatherCat);
  const desiredAccessories = Math.min(accessoryLimit, variant === 0 ? 1 : variant === 1 ? 2 : 0);
  const accessoryFamilies = new Set();

  for (const accessory of accessoryCandidates) {
    if ((roleCounts.get("accessory") || 0) >= desiredAccessories) break;
    const family = accessoryFamily(accessory);
    if (accessoryFamilies.has(family)) continue;
    if (context.weatherCat === "hot" && family === "scarf") continue;
    if (preferredOccasionsFromAnswers(context.answers).includes("athletic") && ["jewelry", "belt"].includes(family)) continue;
    if (outfit.length >= 4 && family === "scarf" && (selectedLayerTypes.has("mid") || selectedLayerTypes.has("outer"))) continue;
    if (addItem(accessory)) accessoryFamilies.add(family);
  }

  return outfit;
}

function mappedOutfit(items) {
  return withUniqueById(items).map((x, i) => ({
    id: x.id ?? `w${i}_${x._idx}`,
    name: x.name ?? "Wardrobe item",
    category: normalizeCategory(x.category),
    color: titleCase(x.color || ""),
    fit_tag: normalizeFitTag(x.fit_tag),
    image_url: x.image_url || "",
    clothing_type: x.clothing_type || "",
    layer_type: x.layer_type || "",
    is_one_piece: !!x.is_one_piece,
    set_id: x.set_id || "",
    style_tags: normalizeTagArray(x.style_tags),
    occasion_tags: normalizeTagArray(x.occasion_tags),
    season_tags: normalizeTagArray(x.season_tags),
  }));
}

function scoreOutfitCandidate(outfit, context) {
  if (!Array.isArray(outfit) || !outfit.length) return -Infinity;

  const roles = new Set(outfit.map(itemRole));
  let score = 0;

  if (roles.has("one-piece")) {
    /* One-piece covers top + bottom — award full coverage credit */
    score += 24;
    /* Penalize if a standalone top or bottom sneaked in alongside */
    if (roles.has("top")) score -= 15;
    if (roles.has("bottom")) score -= 15;
  } else {
    if (roles.has("top")) score += 12;
    if (roles.has("bottom")) score += 12;
  }
  if (roles.has("shoes")) score += 12;

  const layers = new Set(outfit.map((item) => item.layer_type).filter(Boolean));
  const targetLayers = targetLayersForWeather(context.weatherCat);
  for (const layer of targetLayers) {
    if (layers.has(layer)) score += 6;
  }
  if ((context.weatherCat === "cold" || context.weatherCat === "cool") && !roles.has("outerwear") && !layers.has("outer")) {
    score -= 10;
  }
  if ((context.weatherCat === "warm" || context.weatherCat === "hot") && (roles.has("outerwear") || layers.has("outer"))) {
    score -= 8;
  }

  /* ── Layering realism bonuses / penalties ───────────────────────── */
  const wCat = (context.weatherCat || "mild").toString().trim().toLowerCase();

  /* Full 3-layer bonus for cold weather */
  if (wCat === "cold" && layers.has("base") && layers.has("mid") && layers.has("outer")) {
    score += 12;
  }
  /* 2-layer bonus for cool weather */
  if (wCat === "cool" && layers.has("base") && (layers.has("mid") || layers.has("outer"))) {
    score += 6;
  }
  /* Penalty: cold weather missing mid-layer */
  if (wCat === "cold" && layers.has("base") && !layers.has("mid") && layers.has("outer")) {
    score -= 4;
  }

  /* Warmth budget scoring */
  score += warmthScore(outfit, wCat);

  for (const item of outfit) {
    score += metadataScore(item, { ...context, outfitSoFar: outfit.filter((entry) => entry?.id !== item?.id) });
  }

  const accessories = outfit.filter((item) => itemRole(item) === "accessory");
  if (accessories.length > 3) score -= (accessories.length - 3) * 12;

  const familySet = new Set(accessories.map(accessoryFamily));
  if (familySet.size !== accessories.length) score -= 8;

  const setIds = [...new Set(outfit.map((item) => normalizeSetId(item?.set_id)).filter(Boolean))];
  for (const setId of setIds) {
    const matches = outfit.filter((item) => normalizeSetId(item?.set_id) === setId).length;
    if (matches >= 2) score += 10 + (matches - 2) * 4;
  }

  for (let i = 0; i < outfit.length; i += 1) {
    for (let j = i + 1; j < outfit.length; j += 1) {
      score += pairScore(outfit[i]?.color, outfit[j]?.color) * 2;
      if (itemsConflict(outfit[i], outfit[j])) score -= 20;
    }
  }

  return score;
}

export function generateThreeOutfits(items, seedNumber, bodyTypeId, recentExactSigs, recentItemCounts, weatherCat, timeCat, answers, savedSigs) {
  const active = (Array.isArray(items) ? items : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );

  if (active.length === 0) {
    return [];
  }

  const seed = typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const rng = mulberry32(seed);
  const buckets = bucketWardrobe(active);
  const skipSigs = savedSigs instanceof Set ? savedSigs : new Set();
  const recentSigs = recentExactSigs instanceof Set ? recentExactSigs : new Set();
  const context = {
    answers,
    bodyTypeId,
    recentItemCounts,
    weatherCat: (weatherCat || "mild").toString().toLowerCase(),
    timeCat: (timeCat || "work hours").toString().toLowerCase(),
    selectedSeason: seasonFromDate(new Date()),
  };

  const candidates = [];
  const seenSigs = new Set();

  for (let variant = 0; variant < 12; variant += 1) {
    const outfit = buildOutfitCandidate(buckets, rng, context, variant);
    const mapped = mappedOutfit(outfit);
    if (!mapped.length) continue;

    const sig = idsSignature(mapped.map((item) => item.id));
    if (!sig || seenSigs.has(sig) || skipSigs.has(sig)) continue;

    let score = scoreOutfitCandidate(mapped, context);
    if (recentSigs.has(sig)) score -= 18;
    score -= variant;

    seenSigs.add(sig);
    candidates.push({ outfit: mapped, score, sig });
  }

  candidates.sort((a, b) => b.score - a.score);

  const results = candidates.slice(0, 3).map((entry) => entry.outfit);
  if (!results.length) return [];
  while (results.length < 3) results.push(results[results.length - 1]);
  return results.slice(0, 3);
}

export function scoreOutfitForDisplay(outfit, { weatherCategory, timeCategory, answers, bodyTypeId } = {}) {
  const mapped = mappedOutfit(Array.isArray(outfit) ? outfit : []);
  if (!mapped.length) return 0;

  const score = scoreOutfitCandidate(mapped, {
    answers,
    bodyTypeId: bodyTypeId || DEFAULT_BODY_TYPE,
    recentItemCounts: new Map(),
    weatherCat: (weatherCategory || "mild").toString().toLowerCase(),
    timeCat: (timeCategory || "work hours").toString().toLowerCase(),
    selectedSeason: seasonFromDate(new Date()),
  });

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function signatureFromItems(items) {
  const ids = normalizeItems((items || []).map((x) => x?.id));
  return ids.join("|");
}

export { idsSignature };

export function makeRecentSets(historyList, recentN = 10) {
  const sigs = new Set();
  const itemCounts = new Map();

  const recent = (Array.isArray(historyList) ? historyList : []).slice(0, recentN);

  for (const h of recent) {
    const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
    const sig = idsSignature(ids);
    if (sig) sigs.add(sig);

    for (const id of ids) {
      const key = (id ?? "").toString().trim();
      if (!key) continue;
      itemCounts.set(key, (itemCounts.get(key) || 0) + 1);
    }
  }

  return { sigs, itemCounts };
}



function uniqueNonEmpty(values) {
  const out = [];
  for (const v of values) {
    const val = (v || "").toString().trim();
    if (!val) continue;
    if (!out.includes(val)) out.push(val);
  }
  return out;
}

const BODY_TYPE_LABELS = {
  pear: "Pear",
  apple: "Apple",
  hourglass: "Hourglass",
  rectangle: "Rectangle",
  inverted: "Inverted Triangle",
};

export function bodyTypeLabelFromId(bodyTypeId) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();
  return BODY_TYPE_LABELS[id] || titleCase(id);
}

function explanationHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function describeColorHarmony(colors, seed) {
  if (colors.length < 2) {
    if (colors.length === 1) return `${titleCase(colors[0])} anchors the look.`;
    return "";
  }

  const entries = colors.slice(0, 3).map((c) => ({ display: titleCase(c), info: colorInfo(c) }));
  const names = entries.map((e) => e.display);
  const neutralEntries = entries.filter((e) => e.info.neutral);
  const chromaticEntries = entries.filter((e) => !e.info.neutral && e.info.hue >= 0);
  const allNeutral = entries.every((e) => e.info.neutral);

  if (allNeutral) {
    const listStr = names.length > 2
      ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
      : names.join(" and ");
    return [
      `${listStr} — a timeless neutral combo.`,
      `Classic palette with ${names.join(", ")}.`,
      `A ${names.join(", ")} base keeps things clean and versatile.`,
    ][seed % 3];
  }

  if (chromaticEntries.length >= 2) {
    const [a, b] = chromaticEntries;
    const diff = hueDiff(a.info.hue, b.info.hue);

    if (diff >= 150 && diff <= 210) {
      return `${a.display} and ${b.display} are complementary — bold but balanced.`;
    }
    if (diff <= 40) {
      return `${a.display} and ${b.display} sit close on the color wheel, so they blend naturally.`;
    }
    if (diff >= 100 && diff <= 149) {
      return `${a.display} and ${b.display} create a vibrant contrast that still feels intentional.`;
    }
    return `${a.display} and ${b.display} add energy with their contrast.`;
  }

  if (neutralEntries.length && chromaticEntries.length === 1) {
    const nNames = neutralEntries.map((e) => e.display);
    const cName = chromaticEntries[0].display;
    if (nNames.length > 1) {
      return [
        `${cName} stands out against the ${nNames.join(" and ")} foundation.`,
        `${nNames.join(" and ")} anchor the look while ${cName} adds interest.`,
        `${cName} with ${nNames.join(" and ")} — clean and intentional.`,
      ][seed % 3];
    }
    return [
      `${nNames[0]} grounds the ${cName} well.`,
      `${cName} pops against the ${nNames[0]} base.`,
      `${cName} with ${nNames[0]} keeps things polished.`,
    ][seed % 3];
  }

  return `The ${names.join(", ")} palette ties everything together.`;
}

function weatherSentence(weatherCat, seed) {
  const templates = {
    cold: [
      "Layered for the cold without looking bulky.",
      "Built to handle chilly weather in style.",
      "Warm enough for the cold, still sharp.",
    ],
    cool: [
      "Light layers for the crisp weather.",
      "Just enough warmth for a cool day.",
      "Layered lightly for the cool air.",
    ],
    warm: [
      "Breathable picks for the warm weather.",
      "Light and easy for a warm day.",
      "Warm-weather friendly without sacrificing style.",
    ],
    hot: [
      "Lightweight and breathable — built for the heat.",
      "Minimal layers to stay cool in the heat.",
      "Light fabrics to beat the heat.",
    ],
  };
  const opts = templates[weatherCat] || [];
  return opts.length ? opts[seed % opts.length] : "";
}

function bodyTypeSentence(bodyTypeId, seed) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();
  const templates = {
    pear: [
      "The structure up top balances your frame nicely.",
      "Adds definition on top while keeping the lower half streamlined.",
    ],
    apple: [
      "Clean lines through the middle keep things flattering.",
      "Light structure for a comfortable, defined silhouette.",
    ],
    hourglass: [
      "Highlights the waist while keeping proportions even.",
      "Plays up your natural proportions.",
    ],
    inverted: [
      "Balances the shoulders with more presence below.",
      "Draws attention downward for an even silhouette.",
    ],
    rectangle: [
      "Layers and contrast add shape and dimension.",
      "Creates visual interest and definition throughout.",
    ],
  };
  const opts = templates[id] || ["Balanced proportions for a clean look."];
  return opts[seed % opts.length];
}

function outfitMetadataSentence(outfit, weatherCategory, seed) {
  const items = Array.isArray(outfit) ? outfit : [];
  const layerTypes = uniqueNonEmpty(items.map((item) => item?.layer_type).filter(Boolean));
  const setIds = items.map((item) => normalizeSetId(item?.set_id)).filter(Boolean);
  const hasSet = setIds.some((setId) => items.filter((item) => normalizeSetId(item?.set_id) === setId).length >= 2);
  const hasOnePiece = items.some((item) => item?.is_one_piece);
  const styles = uniqueNonEmpty(items.flatMap((item) => normalizeTagArray(item?.style_tags))).map(titleCase);
  const seasons = uniqueNonEmpty(items.flatMap((item) => normalizeTagArray(item?.season_tags))).map(titleCase);
  const accessories = items.filter((item) => itemRole(item) === "accessory");

  if (hasOnePiece) {
    return [
      "The one-piece foundation keeps the outfit simple and intentional.",
      "Using a one-piece item keeps the silhouette clean without extra layers.",
    ][seed % 2];
  }

  if ((weatherCategory === "cold" || weatherCategory === "cool") && layerTypes.includes("base") && (layerTypes.includes("mid") || layerTypes.includes("outer"))) {
    return [
      "The layers build from a base piece upward, so the outfit feels realistic for cooler weather.",
      "This combination uses layering in a natural order, which makes it feel practical and polished.",
      "The base-to-outer layering keeps the outfit believable for cooler conditions.",
    ][seed % 3];
  }

  if (hasSet) {
    return [
      "The matching set pieces help the outfit feel coordinated without looking forced.",
      "Keeping the set together makes the recommendation look more intentional.",
    ][seed % 2];
  }

  if (styles.length) {
    return [
      `${styles[0]} details keep the outfit pointed in one direction.`,
      `The ${styles[0].toLowerCase()} styling keeps the look consistent from piece to piece.`,
    ][seed % 2];
  }

  if (seasons.length) {
    return `${seasons[0]}-friendly pieces help the outfit feel on season.`;
  }

  if (accessories.length > 0 && accessories.length <= 2) {
    return "The accessories stay light, so they finish the outfit without cluttering it.";
  }

  return "The pieces work together without competing for the same role in the outfit.";
}

export function buildExplanation({ answers, outfit, weatherCategory, timeCategory }) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  const style = Array.isArray(answers?.style) ? answers.style : [];
  const bodyTypeId = answers?.bodyType || DEFAULT_BODY_TYPE;

  const hasOutfit = Array.isArray(outfit) && outfit.length > 0;
  if (!hasOutfit) return "Pick a style and an occasion in onboarding to get a personalized explanation.";

  const occasion = dressFor.length ? titleCase(dressFor[0]) : "";
  const styleHint = style.length ? style[0].toLowerCase() : "";
  const colors = uniqueNonEmpty((outfit || []).flatMap((x) => splitColors(x?.color || "").length ? splitColors(x.color) : [x?.color]));

  const seed = explanationHash(outfit.map((x) => `${x?.name}${x?.color}`).join(""));

  const isNotableWeather = weatherCategory && weatherCategory !== "mild";
  const timePh = { morning: "this morning", "work hours": "today", evening: "tonight", night: "tonight" }[timeCategory] || "";
  const timeHint = !isNotableWeather && timePh ? ` ${timePh}` : "";

  const styleMatchesOccasion = styleHint && occasion && styleHint.toLowerCase() === occasion.toLowerCase();

  let opener;
  if (occasion && styleHint && !styleMatchesOccasion) {
    opener = [
      `A ${styleHint} look for ${occasion}${timeHint}.`,
      `This outfit leans ${styleHint} while still fitting ${occasion}${timeHint}.`,
      `Put together for ${occasion} with a ${styleHint} edge.`,
    ][seed % 3];
  } else if (occasion) {
    opener = [
      `A solid pick for ${occasion}${timeHint}.`,
      `Well-suited for ${occasion}${timeHint}.`,
      `Right on point for ${occasion}${timeHint}.`,
    ][seed % 3];
  } else if (styleHint) {
    opener = [`A clean ${styleHint} look${timeHint}.`, `This has a nice ${styleHint} feel.`][seed % 2];
  } else {
    opener = ["A well-rounded outfit.", "A solid combination."][seed % 2];
  }

  const structureSent = outfitMetadataSentence(outfit, weatherCategory, seed);
  const colorSent = describeColorHarmony(colors, seed);
  const closing = isNotableWeather
    ? weatherSentence(weatherCategory, seed)
    : bodyTypeSentence(bodyTypeId, seed);

  return [opener, structureSent, colorSent, closing].filter(Boolean).join(" ").trim();
}

/* ?????? Outfit reuse helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????? */

export function buildOutfitFromIds(ids, wardrobe) {
  const pool = Array.isArray(wardrobe) ? wardrobe : [];
  const byId = new Map(pool.map((x) => [x?.id?.toString?.() || x?.id, x]));

  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const found = byId.get(id) || byId.get((id ?? "").toString());
    if (found) {
      out.push({
        id: found.id ?? id,
        name: found.name || "Wardrobe item",
        category: normalizeCategory(found.category),
        color: titleCase(normalizeColorName(found.color || "")),
        fit_tag: normalizeFitTag(found.fit_tag || found.fitTag || found.fit),
        image_url: found.image_url || "",
      });
    } else {
      out.push({
        id,
        name: "Saved item",
        category: "",
        color: "",
        fit_tag: "unspecified",
      });
    }
  }
  return out;
}
