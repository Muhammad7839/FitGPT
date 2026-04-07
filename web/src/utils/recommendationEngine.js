
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

/* ── Color relationship analysis ───────────────────────────────────── */

export function analyzeColorRelationship(colorA, colorB) {
  const a = colorInfo(colorA);
  const b = colorInfo(colorB);

  if (!a.name || !b.name) return { type: "unknown", score: 0, nameA: a.name, nameB: b.name };
  if (a.name === b.name) return { type: "monochrome", score: 2, nameA: a.name, nameB: b.name };

  if (a.neutral && b.neutral) return { type: "neutral-pair", score: 4, nameA: a.name, nameB: b.name };

  if (a.neutral || b.neutral) {
    const darkNeutrals = new Set(["black", "navy", "brown", "gray", "grey", "denim"]);
    const neutral = a.neutral ? a.name : b.name;
    const score = darkNeutrals.has(neutral) ? 4 : 3;
    return { type: "neutral-anchor", score, nameA: a.name, nameB: b.name };
  }

  if (a.hue < 0 || b.hue < 0) return { type: "unknown", score: 2, nameA: a.name, nameB: b.name };

  const diff = hueDiff(a.hue, b.hue);
  if (diff <= 15) return { type: "monochrome", score: 4, nameA: a.name, nameB: b.name };
  if (diff <= 45) return { type: "analogous", score: 4, nameA: a.name, nameB: b.name };
  if (diff >= 150 && diff <= 210) return { type: "complementary", score: 5, nameA: a.name, nameB: b.name };
  if (diff >= 100 && diff <= 149) return { type: "triadic", score: 3, nameA: a.name, nameB: b.name };
  if (diff >= 50 && diff < 100) return { type: "clash", score: 1, nameA: a.name, nameB: b.name };
  return { type: "contrast", score: 2, nameA: a.name, nameB: b.name };
}

export function analyzeOutfitColors(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  const allColors = items.flatMap((x) => {
    const parts = splitColors(x?.color || "");
    return parts.length ? parts : [x?.color];
  }).filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const raw of allColors) {
    const n = normalizeColorName(raw);
    if (n && !seen.has(n)) { seen.add(n); unique.push(n); }
  }

  const infos = unique.map(colorInfo);
  const neutralCount = infos.filter((i) => i.neutral).length;
  const chromaticCount = infos.filter((i) => !i.neutral && i.hue >= 0).length;

  const relationships = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      relationships.push(analyzeColorRelationship(unique[i], unique[j]));
    }
  }

  const typeCounts = {};
  for (const rel of relationships) {
    if (rel.type !== "unknown") typeCounts[rel.type] = (typeCounts[rel.type] || 0) + 1;
  }

  let dominantType = "mixed";
  let maxCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) { maxCount = count; dominantType = type; }
  }

  const isBalanced = neutralCount >= 1 && chromaticCount >= 1;
  const harmonyScore = relationships.length
    ? relationships.reduce((sum, r) => sum + r.score, 0) / relationships.length
    : 0;

  return { relationships, dominantType, typeCounts, neutralCount, chromaticCount, isBalanced, harmonyScore, uniqueColors: unique };
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

/* ── Metadata-based tag suggestion ─────────────────────────────────── */

const TAG_SUGGESTIONS = {
  "t-shirt":       { style: ["casual"],         occasion: ["casual"],           season: ["summer", "spring"] },
  "tank top":      { style: ["casual"],         occasion: ["casual", "athletic"], season: ["summer"] },
  "polo":          { style: ["smart casual"],   occasion: ["work", "casual"],   season: ["spring", "summer"] },
  "dress shirt":   { style: ["formal"],         occasion: ["work", "formal"],   season: [] },
  "blouse":        { style: ["smart casual"],   occasion: ["work", "social"],   season: [] },
  "henley":        { style: ["casual"],         occasion: ["casual"],           season: ["fall", "spring"] },
  "turtleneck":    { style: ["smart casual"],   occasion: ["work", "social"],   season: ["winter", "fall"] },
  "hoodie":        { style: ["casual", "relaxed"], occasion: ["casual"],        season: ["fall", "winter"] },
  "sweater":       { style: ["casual"],         occasion: ["casual", "work"],   season: ["winter", "fall"] },
  "cardigan":      { style: ["smart casual"],   occasion: ["casual", "work"],   season: ["fall", "spring"] },
  "sweatshirt":    { style: ["casual", "relaxed"], occasion: ["casual"],        season: ["fall", "winter"] },
  "blazer":        { style: ["formal", "smart casual"], occasion: ["work", "formal"], season: [] },
  "jacket":        { style: ["casual"],         occasion: ["casual"],           season: ["fall", "spring"] },
  "coat":          { style: ["formal"],         occasion: ["work", "formal"],   season: ["winter"] },
  "parka":         { style: ["casual"],         occasion: ["casual"],           season: ["winter"] },
  "windbreaker":   { style: ["activewear"],     occasion: ["athletic", "casual"], season: ["spring", "fall"] },
  "vest":          { style: ["smart casual"],   occasion: ["casual", "work"],   season: ["fall"] },
  "shorts":        { style: ["casual"],         occasion: ["casual"],           season: ["summer"] },
  "dress":         { style: ["formal"],         occasion: ["social", "formal"], season: [] },
  "jumpsuit":      { style: ["smart casual"],   occasion: ["social"],           season: ["summer", "spring"] },
  "skirt":         { style: ["smart casual"],   occasion: ["social", "work"],   season: [] },
  "sneakers":      { style: ["casual"],         occasion: ["casual", "athletic"], season: [] },
  "boots":         { style: ["casual"],         occasion: ["casual", "work"],   season: ["winter", "fall"] },
  "sandals":       { style: ["casual"],         occasion: ["casual"],           season: ["summer"] },
  "dress shoes":   { style: ["formal"],         occasion: ["work", "formal"],   season: [] },
  "hat":           { style: ["casual"],         occasion: ["casual"],           season: ["summer"] },
  "scarf":         { style: ["smart casual"],   occasion: ["casual"],           season: ["winter", "fall"] },
  "watch":         { style: [],                 occasion: [],                   season: [] },
  "belt":          { style: ["smart casual"],   occasion: ["work"],             season: [] },
  "sunglasses":    { style: ["casual"],         occasion: ["casual"],           season: ["summer", "spring"] },
};

const CATEGORY_FALLBACK_TAGS = {
  Tops:        { style: ["casual"],  occasion: ["casual"],  season: [] },
  Bottoms:     { style: ["casual"],  occasion: ["casual"],  season: [] },
  Outerwear:   { style: ["casual"],  occasion: ["casual"],  season: ["fall", "winter"] },
  Shoes:       { style: ["casual"],  occasion: ["casual"],  season: [] },
  Accessories: { style: [],          occasion: [],          season: [] },
};

export function suggestItemTags(clothingType, category) {
  const type = normalizeClothingType(clothingType);
  const cat = normalizeCategory(category);
  const layer_type = normalizeLayerType(undefined, type, cat);

  const match = TAG_SUGGESTIONS[type];
  const fallback = CATEGORY_FALLBACK_TAGS[cat] || { style: [], occasion: [], season: [] };
  const source = match || fallback;

  return {
    style_tags: [...source.style],
    occasion_tags: [...source.occasion],
    season_tags: [...source.season],
    layer_type: layer_type || "",
  };
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

/* ── Weather condition → outfit type mapping ──────────────────────── */

const WEATHER_OUTFIT_MAP = {
  rain: {
    boost:    ["raincoat", "anorak", "trench coat", "windbreaker", "boots", "rain boots", "parka"],
    penalize: ["sandals", "flip flops", "slides", "canvas shoes", "espadrilles"],
    requireOuterwear: true,
  },
  snow: {
    boost:    ["parka", "down jacket", "puffer jacket", "coat", "overcoat", "boots", "rain boots", "scarf", "turtleneck", "fleece"],
    penalize: ["sandals", "flip flops", "slides", "canvas shoes", "espadrilles", "tank top", "crop top", "shorts"],
    requireOuterwear: true,
  },
  storm: {
    boost:    ["raincoat", "anorak", "parka", "down jacket", "puffer jacket", "windbreaker", "boots", "rain boots"],
    penalize: ["sandals", "flip flops", "slides", "canvas shoes", "espadrilles", "tank top", "crop top"],
    requireOuterwear: true,
  },
  clear: { boost: [], penalize: [], requireOuterwear: false },
};

const WATERPROOF_TYPES = new Set([
  "raincoat", "rain jacket", "anorak", "rain boots", "rubber boots", "galoshes",
]);

const WATER_RESISTANT_TYPES = new Set([
  "trench coat", "windbreaker", "parka", "down jacket", "puffer jacket",
]);

const OPEN_TOE_TYPES = new Set([
  "sandals", "flip flops", "slides", "espadrilles", "open-toe heels",
]);

const WET_VULNERABLE_KEYWORDS = ["suede", "canvas", "linen", "silk"];

export function classifyWeatherProtection(item) {
  const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
  const name = (item?.name || "").toLowerCase();

  return {
    waterproof:     WATERPROOF_TYPES.has(type) || name.includes("rain") || name.includes("waterproof"),
    waterResistant: WATER_RESISTANT_TYPES.has(type) || name.includes("water-resistant") || name.includes("water resistant"),
    closedToe:      !OPEN_TOE_TYPES.has(type) && normalizeCategory(item?.category) === "Shoes",
    openToe:        OPEN_TOE_TYPES.has(type),
    insulated:      ["parka", "down jacket", "puffer jacket", "fleece"].includes(type) || name.includes("insulated"),
    vulnerableToWet: WET_VULNERABLE_KEYWORDS.some((kw) => name.includes(kw)),
  };
}

function precipScoreBias(item, precipCat) {
  if (!precipCat || precipCat === "clear") return 0;

  const prot = classifyWeatherProtection(item);
  const role = itemRole(item);
  const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
  const map = WEATHER_OUTFIT_MAP[precipCat] || WEATHER_OUTFIT_MAP.clear;
  let score = 0;

  if (map.boost.includes(type)) score += 8;
  if (map.penalize.includes(type)) score -= 10;

  if (precipCat === "rain" || precipCat === "storm") {
    if (prot.waterproof) score += 10;
    else if (prot.waterResistant) score += 5;

    if (role === "shoes") {
      if (prot.openToe) score -= 12;
      else if (prot.closedToe) score += 3;
    }
    if (role === "outerwear" && !prot.waterproof && !prot.waterResistant) score -= 4;
    if (prot.vulnerableToWet) score -= 8;
  }

  if (precipCat === "snow") {
    if (prot.waterproof && prot.insulated) score += 12;
    else if (prot.waterproof) score += 7;
    else if (prot.insulated) score += 5;

    if (role === "shoes") {
      if (prot.openToe) score -= 15;
      else if (prot.closedToe) score += 4;
    }
    if (prot.vulnerableToWet) score -= 10;
  }

  return score;
}

function comfortPreferences(answers) {
  const raw = Array.isArray(answers?.comfort) ? answers.comfort : [];
  return new Set(raw.map((v) => (v || "").toString().trim().toLowerCase()).filter(Boolean));
}

function comfortFitScore(fitTag, comfortSet) {
  const fit = normalizeDashboardFit(fitTag);
  if (fit === "unspecified" || fit === "regular") return 0;

  let score = 0;
  if (comfortSet.has("relaxed")) {
    if (fit === "relaxed" || fit === "oversized") score += 6;
    else if (fit === "tight" || fit === "fitted") score -= 3;
  }
  if (comfortSet.has("fitted")) {
    if (fit === "fitted" || fit === "tight") score += 6;
    else if (fit === "oversized") score -= 3;
  }
  if (comfortSet.has("stretchy")) {
    if (fit === "relaxed" || fit === "regular") score += 3;
  }
  return score;
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
  score += precipScoreBias(item, context.precipCat);
  score -= fitPenalty(item?.fit_tag, bodyTypeId, item?.category);
  score -= recentPenalty;

  /* ── Comfort preference scoring ──────────────────────────────────── */
  const comfortSet = comfortPreferences(answers);
  if (comfortSet.size) {
    score += comfortFitScore(item?.fit_tag, comfortSet);
    if (comfortSet.has("layered") && item?.layer_type) score += 4;
  }

  /* ── Rotation boost for underused items ──────────────────────────── */
  const { underusedIds, neglectedIds } = context;
  if (neglectedIds instanceof Set && neglectedIds.has(id)) score += 4;
  else if (underusedIds instanceof Set && underusedIds.has(id)) score += 3;

  /* ── Feedback-based preference ──────────────────────────────────── */
  if (context.feedbackProfile) {
    score += feedbackBias(item, context.feedbackProfile);
  }

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
  const pCat = (context.precipCat || "clear").toString().trim().toLowerCase();
  const precipNeedsOuter = pCat === "rain" || pCat === "snow" || pCat === "storm";
  const needsOuter = layerTargets.includes("outer") || (wCat === "cool" && variant % 3 !== 2) || precipNeedsOuter;
  /* warm/hot: skip outerwear — unless precipitation demands it */
  const skipOuter = (wCat === "warm" || wCat === "hot") && !precipNeedsOuter;

  if (needsOuter && !skipOuter) {
    const preferredOuter = outerCandidates.filter((item) => !item.layer_type || item.layer_type === "outer");
    let sortedOuter;
    if (precipNeedsOuter) {
      /* Rain/snow/storm: prefer waterproof/water-resistant outerwear first */
      const pool = preferredOuter.length ? preferredOuter : outerCandidates;
      sortedOuter = [...pool].sort((a, b) => {
        const pa = classifyWeatherProtection(a);
        const pb = classifyWeatherProtection(b);
        const wa = (pa.waterproof ? 3 : pa.waterResistant ? 1 : 0) + (pa.insulated && pCat === "snow" ? 2 : 0);
        const wb = (pb.waterproof ? 3 : pb.waterResistant ? 1 : 0) + (pb.insulated && pCat === "snow" ? 2 : 0);
        return wb - wa || layerWarmth(b) - layerWarmth(a);
      });
    } else if (wCat === "cold") {
      /* cold weather: prefer heavier outerwear */
      sortedOuter = [...(preferredOuter.length ? preferredOuter : outerCandidates)].sort((a, b) => layerWarmth(b) - layerWarmth(a));
    } else {
      sortedOuter = preferredOuter.length ? preferredOuter : outerCandidates;
    }
    addItem(chooseFirstCompatible(sortedOuter, outfit));
  }

  /* ── Shoes: prefer closed-toe in precipitation ─────────────────── */
  const shoeContext = outfit.filter((item) => ["one-piece", "top", "bottom", "outerwear"].includes(itemRole(item)));
  let rankedShoes = sortCandidates(shoeCandidates, context, shoeContext.length ? shoeContext : outfit, rng);
  if (precipNeedsOuter) {
    const closedToe = rankedShoes.filter((item) => !classifyWeatherProtection(item).openToe);
    if (closedToe.length) rankedShoes = closedToe;
  }
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

  /* ── Precipitation awareness ────────────────────────────────────── */
  const pCat = (context.precipCat || "clear").toString().trim().toLowerCase();
  if (pCat === "rain" || pCat === "snow" || pCat === "storm") {
    const hasWaterproofOuter = outfit.some((item) => {
      const p = classifyWeatherProtection(item);
      return itemRole(item) === "outerwear" && (p.waterproof || p.waterResistant);
    });
    const hasAnyOuter = roles.has("outerwear") || layers.has("outer");
    if (hasWaterproofOuter) score += 10;
    else if (hasAnyOuter) score -= 4;
    else score -= 12;

    const hasOpenToeShoes = outfit.some((item) => itemRole(item) === "shoes" && classifyWeatherProtection(item).openToe);
    if (hasOpenToeShoes) score -= 15;

    const wetVulnerableCount = outfit.filter((item) => classifyWeatherProtection(item).vulnerableToWet).length;
    score -= wetVulnerableCount * 6;
  }

  /* ── Comfort preference outfit-level bonus ─────────────────────── */
  const comfortSet = comfortPreferences(context.answers);
  if (comfortSet.has("layered") && layers.size >= 2) score += 8;
  if (comfortSet.has("relaxed")) {
    const relaxedCount = outfit.filter((item) => { const f = normalizeDashboardFit(item?.fit_tag); return f === "relaxed" || f === "oversized"; }).length;
    if (relaxedCount >= 2) score += 6;
  }
  if (comfortSet.has("fitted")) {
    const fittedCount = outfit.filter((item) => { const f = normalizeDashboardFit(item?.fit_tag); return f === "fitted" || f === "tight"; }).length;
    if (fittedCount >= 2) score += 6;
  }

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

export function generateThreeOutfits(items, seedNumber, bodyTypeId, recentExactSigs, recentItemCounts, weatherCat, timeCat, answers, savedSigs, rejectedOutfits, underusedIds, neglectedIds, precipCat, feedbackProfile) {
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
    precipCat: (precipCat || "clear").toString().toLowerCase(),
    timeCat: (timeCat || "work hours").toString().toLowerCase(),
    selectedSeason: seasonFromDate(new Date()),
    underusedIds: underusedIds instanceof Set ? underusedIds : new Set(),
    neglectedIds: neglectedIds instanceof Set ? neglectedIds : new Set(),
    feedbackProfile: feedbackProfile || null,
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
    if (Array.isArray(rejectedOutfits) && rejectedOutfits.length) {
      score -= rejectionPenalty(mapped, rejectedOutfits, Date.now());
    }
    score -= variant;

    /* Exploration noise: when personalization is low, add randomness to
       diversify recommendations. As the model learns, noise shrinks.
       Only applies when a feedback profile exists (skip for cold-start). */
    if (context.feedbackProfile && context.feedbackProfile.totalEntries > 0) {
      const expFactor = context.feedbackProfile.explorationFactor ?? 1;
      if (expFactor > 0.15) {
        score += (rng() - 0.5) * expFactor * 16;
      }
    }

    seenSigs.add(sig);
    candidates.push({ outfit: mapped, score, sig });
  }

  candidates.sort((a, b) => b.score - a.score);

  const results = candidates.slice(0, 3).map((entry) => entry.outfit);
  if (!results.length) return [];
  while (results.length < 3) results.push(results[results.length - 1]);
  return results.slice(0, 3);
}

export function scoreOutfitForDisplay(outfit, { weatherCategory, precipCategory, timeCategory, answers, bodyTypeId, feedbackProfile } = {}) {
  const mapped = mappedOutfit(Array.isArray(outfit) ? outfit : []);
  if (!mapped.length) return 0;

  const score = scoreOutfitCandidate(mapped, {
    answers,
    bodyTypeId: bodyTypeId || DEFAULT_BODY_TYPE,
    recentItemCounts: new Map(),
    weatherCat: (weatherCategory || "mild").toString().toLowerCase(),
    precipCat: (precipCategory || "clear").toString().toLowerCase(),
    timeCat: (timeCategory || "work hours").toString().toLowerCase(),
    selectedSeason: seasonFromDate(new Date()),
    feedbackProfile: feedbackProfile || null,
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

/* ── Underused item detection ──────────────────────────────────────── */

export function buildWearProfile(wardrobeItems, historyList) {
  const history = Array.isArray(historyList) ? historyList : [];
  const items = Array.isArray(wardrobeItems) ? wardrobeItems : [];
  const profile = new Map();

  for (const item of items) {
    const id = (item?.id ?? "").toString().trim();
    if (id) profile.set(id, { totalWears: 0, lastWornAt: null });
  }

  for (const entry of history) {
    const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
    const wornAt = entry?.worn_at ? new Date(entry.worn_at) : null;
    for (const raw of ids) {
      const id = (raw ?? "").toString().trim();
      if (!id) continue;
      const existing = profile.get(id);
      if (existing) {
        existing.totalWears += 1;
        if (wornAt && (!existing.lastWornAt || wornAt > existing.lastWornAt)) existing.lastWornAt = wornAt;
      }
    }
  }

  return profile;
}

const NEGLECTED_DAYS = 30;
const UNDERUSED_DAYS = 14;
const UNDERUSED_MAX_WEARS = 2;

export function detectUnderusedItems(wardrobeItems, historyList) {
  const items = (Array.isArray(wardrobeItems) ? wardrobeItems : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );
  const profile = buildWearProfile(items, historyList);
  const now = new Date();
  const results = [];

  for (const item of items) {
    const id = (item?.id ?? "").toString().trim();
    if (!id) continue;
    const data = profile.get(id);
    if (!data) continue;

    const daysSince = data.lastWornAt
      ? (now - data.lastWornAt) / (1000 * 60 * 60 * 24)
      : Infinity;

    let status = "normal";
    let reason = "";

    if (data.totalWears === 0) {
      status = "neglected";
      reason = `${item.name || "This item"} has never been worn.`;
    } else if (daysSince > NEGLECTED_DAYS) {
      status = "neglected";
      reason = `${item.name || "This item"} hasn't been worn in over ${Math.round(daysSince)} days.`;
    } else if (data.totalWears < UNDERUSED_MAX_WEARS && daysSince > UNDERUSED_DAYS) {
      status = "underused";
      reason = `${item.name || "This item"} has only been worn ${data.totalWears} time${data.totalWears === 1 ? "" : "s"}.`;
    }

    if (status !== "normal") {
      results.push({ ...item, _wearStatus: status, _wearReason: reason, _totalWears: data.totalWears, _daysSinceLastWorn: Math.round(daysSince) });
    }
  }

  results.sort((a, b) => {
    if (a._wearStatus === "neglected" && b._wearStatus !== "neglected") return -1;
    if (b._wearStatus === "neglected" && a._wearStatus !== "neglected") return 1;
    return a._totalWears - b._totalWears;
  });

  return results;
}

/* ── Laundry / reuse tracking ──────────────────────────────────────── */

const WASH_THRESHOLDS = {
  "t-shirt": 1, "tank top": 1, "camisole": 1, "polo": 2, "blouse": 2,
  "dress shirt": 2, "henley": 2, "long sleeve": 2,
  "turtleneck": 3, "hoodie": 3, "sweatshirt": 3, "sweater": 4, "cardigan": 4, "fleece": 4,
  "blazer": 5, "jacket": 6, "coat": 8, "parka": 10, "windbreaker": 6,
  "shorts": 2, "jeans": 4, "dress": 1, "jumpsuit": 1, "romper": 1, "skirt": 2,
  "sneakers": 10, "boots": 12, "sandals": 5, "dress shoes": 15,
  "hat": 5, "scarf": 5, "belt": 20, "watch": Infinity, "sunglasses": Infinity,
};

const CATEGORY_WASH_THRESHOLDS = {
  Tops: 2,
  Bottoms: 3,
  Outerwear: 6,
  Shoes: 10,
  Accessories: 15,
};

export function getWashThreshold(clothingType, category) {
  const type = normalizeClothingType(clothingType);
  if (WASH_THRESHOLDS[type] !== undefined) return WASH_THRESHOLDS[type];
  const cat = normalizeCategory(category);
  return CATEGORY_WASH_THRESHOLDS[cat] || 3;
}

export function buildLaundryStatus(wardrobeItems, historyList, lookbackDays) {
  const days = typeof lookbackDays === "number" && lookbackDays > 0 ? lookbackDays : 14;
  const items = (Array.isArray(wardrobeItems) ? wardrobeItems : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );
  const history = Array.isArray(historyList) ? historyList : [];
  const cutoff = Date.now() - days * 86400000;

  const wearCounts = new Map();
  for (const entry of history) {
    const wornAt = entry?.worn_at ? new Date(entry.worn_at).getTime() : 0;
    if (wornAt < cutoff) continue;
    for (const raw of Array.isArray(entry?.item_ids) ? entry.item_ids : []) {
      const id = (raw ?? "").toString().trim();
      if (id) wearCounts.set(id, (wearCounts.get(id) || 0) + 1);
    }
  }

  const results = [];
  for (const item of items) {
    const id = (item?.id ?? "").toString().trim();
    if (!id) continue;
    const wears = wearCounts.get(id) || 0;
    const threshold = getWashThreshold(item?.clothing_type, item?.category);

    let status = "clean";
    if (threshold !== Infinity) {
      if (wears >= Math.ceil(threshold * 1.5)) status = "overdue";
      else if (wears >= threshold) status = "due";
    }

    results.push({
      ...item,
      _wearsSinceWash: wears,
      _washThreshold: threshold,
      _laundryStatus: status,
    });
  }

  return results;
}

export function getLaundryAlerts(wardrobeItems, historyList, lookbackDays) {
  return buildLaundryStatus(wardrobeItems, historyList, lookbackDays)
    .filter((item) => item._laundryStatus !== "clean")
    .sort((a, b) => {
      if (a._laundryStatus === "overdue" && b._laundryStatus !== "overdue") return -1;
      if (b._laundryStatus === "overdue" && a._laundryStatus !== "overdue") return 1;
      return b._wearsSinceWash - a._wearsSinceWash;
    });
}

/* ── Outfit rejection / similarity ─────────────────────────────────── */

export function outfitSimilarity(outfitA, outfitB) {
  const toIds = (o) => new Set(
    (Array.isArray(o) ? o : []).map((x) => (x?.id ?? "").toString()).filter(Boolean)
  );
  const a = toIds(outfitA);
  const b = toIds(outfitB);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((id) => b.has(id)).length;
  return shared / Math.max(a.size, b.size);
}

/* ── History pattern analysis ─────────────────────────────────────── */

function dateKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t) || t <= 0) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupHistoryByDate(historyList) {
  const byDate = {};
  for (const entry of Array.isArray(historyList) ? historyList : []) {
    const key = dateKey(entry?.worn_at);
    if (!key) continue;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(entry);
  }
  return byDate;
}

export function analyzeHistoryPatterns(historyList, wardrobeItems) {
  const list = Array.isArray(historyList) ? historyList : [];
  const byDate = groupHistoryByDate(list);
  const dates = Object.keys(byDate).sort();

  /* ── Repetition tracking ─────────────────────────────────────────── */
  const sigCounts = new Map();
  for (const entry of list) {
    const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
    const sig = [...ids].sort().join("|");
    if (!sig) continue;
    sigCounts.set(sig, (sigCounts.get(sig) || 0) + 1);
  }
  const repeatedOutfits = [];
  for (const [sig, count] of sigCounts) {
    if (count >= 2) {
      repeatedOutfits.push({ signature: sig, count, itemIds: sig.split("|") });
    }
  }
  repeatedOutfits.sort((a, b) => b.count - a.count);

  /* ── Gap detection ───────────────────────────────────────────────── */
  const gaps = [];
  if (dates.length >= 2) {
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
      if (diffDays > 1) {
        gaps.push({ from: dates[i - 1], to: dates[i], days: diffDays - 1 });
      }
    }
  }
  gaps.sort((a, b) => b.days - a.days);

  /* ── Streak tracking ─────────────────────────────────────────────── */
  let currentStreak = 0;
  let longestStreak = 0;
  if (dates.length) {
    const today = dateKey(new Date().toISOString());
    let streak = 1;
    for (let i = dates.length - 1; i >= 1; i--) {
      const curr = new Date(dates[i]);
      const prev = new Date(dates[i - 1]);
      const diff = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
      if (diff === 1) {
        streak++;
      } else {
        if (i === dates.length - 1) break;
        streak = 1;
      }
    }
    /* current streak: only counts if it reaches today or yesterday */
    const lastDate = dates[dates.length - 1];
    const lastDiff = Math.round((new Date(today) - new Date(lastDate)) / (24 * 60 * 60 * 1000));
    currentStreak = lastDiff <= 1 ? streak : 0;

    /* longest streak across all history */
    let s = 1;
    longestStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / (24 * 60 * 60 * 1000));
      if (diff === 1) { s++; longestStreak = Math.max(longestStreak, s); }
      else { s = 1; }
    }
  }

  /* ── Day-of-week distribution ────────────────────────────────────── */
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of list) {
    const d = new Date(entry?.worn_at);
    if (Number.isFinite(d.getTime())) dayCounts[d.getDay()]++;
  }
  const dayOfWeekStats = dayNames.map((name, i) => ({ day: name, count: dayCounts[i] }));
  const mostActiveDay = dayOfWeekStats.reduce((best, d) => d.count > best.count ? d : best, { day: "—", count: 0 });
  const leastActiveDay = dayOfWeekStats.reduce((best, d) => (d.count < best.count ? d : best), { day: "—", count: Infinity });

  /* ── Data validation ─────────────────────────────────────────────── */
  const wardrobeIds = new Set(
    (Array.isArray(wardrobeItems) ? wardrobeItems : []).map((x) => (x?.id ?? "").toString()).filter(Boolean)
  );
  let orphanedItemCount = 0;
  let invalidDateCount = 0;
  for (const entry of list) {
    if (!dateKey(entry?.worn_at)) invalidDateCount++;
    for (const id of Array.isArray(entry?.item_ids) ? entry.item_ids : []) {
      if (id && wardrobeIds.size && !wardrobeIds.has(id.toString())) orphanedItemCount++;
    }
  }

  return {
    byDate,
    totalEntries: list.length,
    trackedDays: dates.length,
    repeatedOutfits,
    gaps,
    currentStreak,
    longestStreak,
    dayOfWeekStats,
    mostActiveDay: mostActiveDay.count > 0 ? mostActiveDay : null,
    leastActiveDay: leastActiveDay.count < Infinity ? leastActiveDay : null,
    orphanedItemCount,
    invalidDateCount,
  };
}

const REJECTION_DECAY_DAYS = 30;
const MAX_REJECTION_PENALTY = 30;

function rejectionPenalty(outfit, rejectedOutfits, now) {
  if (!Array.isArray(rejectedOutfits) || !rejectedOutfits.length) return 0;

  let total = 0;
  for (const entry of rejectedOutfits) {
    const items = entry?.items || entry;
    const sim = outfitSimilarity(outfit, items);
    if (sim === 0) continue;

    const age = entry?.timestamp ? (now - entry.timestamp) / (1000 * 60 * 60 * 24) : 0;
    const decay = age > REJECTION_DECAY_DAYS ? 0.3 : age > 14 ? 0.6 : 1;

    if (sim >= 0.8) total += 25 * decay;
    else if (sim >= 0.5) total += 12 * decay;
    else if (sim >= 0.3) total += 5 * decay;
  }

  return Math.min(total, MAX_REJECTION_PENALTY);
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
  if (!colors.length) return "";
  if (colors.length === 1) {
    return [
      `${titleCase(colors[0])} anchors the look.`,
      `${titleCase(colors[0])} keeps the palette focused.`,
      `A ${titleCase(colors[0])}-driven palette keeps things clean.`,
    ][seed % 3];
  }

  const analysis = analyzeOutfitColors(colors.map((c) => ({ color: c })));
  const names = analysis.uniqueColors.slice(0, 4).map(titleCase);
  const { isBalanced, relationships } = analysis;

  const featured = relationships.find((r) => r.type === "complementary")
    || relationships.find((r) => r.type === "analogous")
    || relationships.find((r) => r.type === "triadic")
    || relationships.find((r) => r.type === "neutral-anchor")
    || relationships.find((r) => r.type === "neutral-pair")
    || relationships.find((r) => r.type === "monochrome")
    || relationships[0];

  if (!featured) return `The ${names.join(", ")} palette ties everything together.`;

  const a = titleCase(featured.nameA);
  const b = titleCase(featured.nameB);

  if (featured.type === "complementary") {
    const templates = [
      `${a} and ${b} are complementary — bold but balanced.`,
      `${a} opposite ${b} on the color wheel gives the outfit energy without competing.`,
      `The ${a}/${b} pairing is a complementary contrast — they strengthen each other.`,
      `${a} and ${b} sit across the wheel, which is why they feel deliberate together.`,
    ];
    let text = templates[seed % templates.length];
    if (isBalanced) text += [" The neutrals ground the intensity.", " Neutral pieces keep the contrast from overwhelming."][seed % 2];
    return text;
  }

  if (featured.type === "analogous") {
    return [
      `${a} and ${b} sit close on the color wheel, so they blend naturally.`,
      `${a} next to ${b} creates a tonal flow that feels effortless.`,
      `The ${a}-to-${b} range keeps the palette cohesive without being monotone.`,
      `${a} and ${b} are analogous — close enough to harmonize, different enough to add depth.`,
    ][seed % 4];
  }

  if (featured.type === "triadic") {
    return [
      `${a} and ${b} create a vibrant contrast that still feels intentional.`,
      `The spread between ${a} and ${b} keeps the palette lively without clashing.`,
      `${a} paired with ${b} — different enough to be interesting, coordinated enough to work.`,
    ][seed % 3];
  }

  if (featured.type === "neutral-anchor") {
    const aInfo = colorInfo(featured.nameA);
    const neutralName = aInfo.neutral ? a : b;
    const chromaticName = aInfo.neutral ? b : a;
    return [
      `${neutralName} grounds the ${chromaticName} well.`,
      `${chromaticName} pops against the ${neutralName} base.`,
      `${chromaticName} with ${neutralName} keeps things polished.`,
      `${neutralName} lets ${chromaticName} do the talking without competing.`,
      `${chromaticName} stands out against ${neutralName} — the balance feels right.`,
    ][seed % 5];
  }

  if (featured.type === "neutral-pair") {
    const allNeutralNames = analysis.uniqueColors.filter((c) => colorInfo(c).neutral).map(titleCase);
    const listStr = allNeutralNames.length > 2
      ? `${allNeutralNames.slice(0, -1).join(", ")}, and ${allNeutralNames[allNeutralNames.length - 1]}`
      : allNeutralNames.join(" and ");
    return [
      `${listStr} — a timeless neutral combo.`,
      `Classic palette with ${allNeutralNames.join(", ")}.`,
      `A ${allNeutralNames.join(", ")} base keeps things clean and versatile.`,
      `The all-neutral palette lets texture and silhouette do the work.`,
    ][seed % 4];
  }

  if (featured.type === "monochrome") {
    return [
      `The monochrome ${a} palette keeps the outfit streamlined.`,
      `Staying in the ${a} family creates a clean, unified look.`,
      `Tonal ${a} dressing — simple and intentional.`,
    ][seed % 3];
  }

  if (featured.type === "clash") {
    return [
      `${a} and ${b} are an unexpected pairing — the contrast keeps things interesting.`,
      `${a} with ${b} pushes the palette, but the outfit structure holds it together.`,
      `The ${a}/${b} tension adds personality to the outfit.`,
    ][seed % 3];
  }

  return `The ${names.join(", ")} palette ties everything together.`;
}

function precipSentence(precipCat, seed) {
  const templates = {
    rain: [
      "Water-resistant layers keep you dry without the bulk.",
      "Picked to handle the rain while staying sharp.",
      "Rain-ready pieces that still look intentional.",
    ],
    snow: [
      "Insulated and protected for snowy conditions.",
      "Built to handle the snow — warm, dry, and polished.",
      "Snow-ready layering that keeps you covered.",
    ],
    storm: [
      "Sealed up for stormy weather without losing the look.",
      "Storm-proof picks that still hold their shape.",
      "Heavy weather calls for heavy-duty layers — this delivers.",
    ],
  };
  const opts = templates[precipCat] || [];
  return opts.length ? opts[seed % opts.length] : "";
}

function weatherSentence(weatherCat, seed, precipCat) {
  const pSent = precipSentence(precipCat, seed);
  if (pSent) return pSent;

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

  const seasonSuffix = seasons.length
    ? [` The ${seasons[0].toLowerCase()}-season pieces keep it on point.`, ` ${seasons[0]} picks help the outfit feel right for the time of year.`][seed % 2]
    : "";

  if (hasOnePiece) {
    return [
      "The one-piece foundation keeps the outfit simple and intentional.",
      "Using a one-piece item keeps the silhouette clean without extra layers.",
    ][seed % 2] + seasonSuffix;
  }

  if ((weatherCategory === "cold" || weatherCategory === "cool") && layerTypes.includes("base") && (layerTypes.includes("mid") || layerTypes.includes("outer"))) {
    return [
      "The layers build from a base piece upward, so the outfit feels realistic for cooler weather.",
      "This combination uses layering in a natural order, which makes it feel practical and polished.",
      "The base-to-outer layering keeps the outfit believable for cooler conditions.",
    ][seed % 3] + seasonSuffix;
  }

  if (hasSet) {
    return [
      "The matching set pieces help the outfit feel coordinated without looking forced.",
      "Keeping the set together makes the recommendation look more intentional.",
    ][seed % 2] + seasonSuffix;
  }

  if (styles.length) {
    return [
      `${styles[0]} details keep the outfit pointed in one direction.`,
      `The ${styles[0].toLowerCase()} styling keeps the look consistent from piece to piece.`,
    ][seed % 2] + seasonSuffix;
  }

  if (seasons.length) {
    return [`${seasons[0]}-friendly pieces help the outfit feel on season.`, `These are ${seasons[0].toLowerCase()}-ready picks that suit the time of year.`][seed % 2];
  }

  if (accessories.length > 0 && accessories.length <= 2) {
    return "The accessories stay light, so they finish the outfit without cluttering it.";
  }

  return "The pieces work together without competing for the same role in the outfit.";
}

export function buildExplanation({ answers, outfit, weatherCategory, precipCategory, timeCategory }) {
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
  const hasPrecip = precipCategory && precipCategory !== "clear";
  const timePh = { morning: "this morning", "work hours": "today", evening: "tonight", night: "tonight" }[timeCategory] || "";
  const timeHint = !isNotableWeather && !hasPrecip && timePh ? ` ${timePh}` : "";

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
  const closing = (isNotableWeather || hasPrecip)
    ? weatherSentence(weatherCategory, seed, precipCategory)
    : bodyTypeSentence(bodyTypeId, seed);

  const comfortSet = comfortPreferences(answers);
  let comfortSent = "";
  if (comfortSet.has("layered")) {
    comfortSent = ["The layered approach matches your comfort preference.", "Built with layering in mind, as you prefer."][seed % 2];
  } else if (comfortSet.has("relaxed")) {
    comfortSent = ["Relaxed fits keep this comfortable through the day.", "The easy silhouette matches your relaxed preference."][seed % 2];
  } else if (comfortSet.has("fitted")) {
    comfortSent = ["The structured fits keep the look sharp, matching your preference.", "Fitted pieces give this a polished edge you prefer."][seed % 2];
  }

  return [opener, structureSent, colorSent, comfortSent, closing].filter(Boolean).join(" ").trim();
}

/* ── Trip packing list generation ──────────────────────────────────── */

const PACKING_QUOTAS = {
  /* base quantities per day, capped at max */
  Tops:        { perDay: 1,    min: 2, max: 10 },
  Bottoms:     { perDay: 0.5,  min: 1, max: 6  },
  Outerwear:   { perDay: 0.25, min: 0, max: 3  },
  Shoes:       { perDay: 0.33, min: 1, max: 3  },
  Accessories: { perDay: 0.2,  min: 0, max: 4  },
};

function packingQuota(category, days, weatherCat, precipCat) {
  const q = PACKING_QUOTAS[category];
  if (!q) return 0;
  const w = (weatherCat || "mild").toString().toLowerCase();
  const p = (precipCat || "clear").toString().toLowerCase();
  let count = Math.max(q.min, Math.ceil(days * q.perDay));

  if (category === "Outerwear") {
    if (w === "hot" && p === "clear") count = 0;
    else if (w === "warm" && p === "clear") count = Math.min(count, 1);
    else if (w === "cold" || w === "cool") count = Math.max(count, 2);
    if (p === "rain" || p === "snow" || p === "storm") count = Math.max(count, 1);
  }
  if (category === "Tops") {
    if (w === "cold" || w === "cool") count = Math.min(count + Math.ceil(days * 0.3), q.max);
  }
  if (category === "Bottoms") {
    if (w === "hot") count = Math.min(count + 1, q.max);
  }
  if (category === "Accessories") {
    if (w === "cold") count = Math.max(count, 2);
    else if (w === "hot") count = Math.min(count, 1);
  }
  if (category === "Shoes") {
    if (p === "rain" || p === "snow") count = Math.max(count, 2);
  }

  return Math.min(count, q.max);
}

function scoreItemForPacking(item, weatherCat, precipCat, preferredOccasions, preferredStyles) {
  let score = 0;

  score += weatherScoreBias(weatherCat, item?.category);
  score += clothingTypeBias(item, weatherCat);
  score += precipScoreBias(item, precipCat);

  const occasions = normalizeTagArray(item?.occasion_tags).map(normalizeOccasionValue);
  const styles = normalizeTagArray(item?.style_tags).map(normalizeStyleValue);
  if (preferredOccasions.length && occasions.some((o) => preferredOccasions.includes(o))) score += 8;
  if (preferredStyles.length && styles.some((s) => preferredStyles.includes(s))) score += 6;

  /* Versatile items score higher — no occasion tags means wearable everywhere */
  if (!occasions.length) score += 3;

  /* Neutral colors pair with more items */
  const color = normalizeColorName(item?.color || "").toLowerCase();
  if (["black", "white", "gray", "grey", "navy", "beige"].includes(color)) score += 4;

  return score;
}

export function generatePackingList(wardrobeItems, { days, weatherCategory, precipCategory, occasion, style } = {}) {
  const tripDays = Math.max(1, Math.min(Number(days) || 3, 30));
  const wCat = (weatherCategory || "mild").toString().toLowerCase();
  const pCat = (precipCategory || "clear").toString().toLowerCase();
  const prefOccasions = normalizeTagArray(occasion ? [occasion] : []).map(normalizeOccasionValue);
  const prefStyles = normalizeTagArray(style ? [style] : []).map(normalizeStyleValue);

  const active = (Array.isArray(wardrobeItems) ? wardrobeItems : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );
  const buckets = bucketWardrobe(active);

  const categories = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];
  const result = {};
  let totalItems = 0;

  for (const cat of categories) {
    const quota = packingQuota(cat, tripDays, wCat, pCat);
    if (quota === 0) { result[cat] = []; continue; }

    const pool = cat === "Accessories"
      ? [...(buckets.Accessories || []), ...(buckets.Other || [])]
      : (buckets[cat] || []);

    /* Score and sort candidates */
    const scored = pool.map((item) => ({
      item,
      score: scoreItemForPacking(item, wCat, pCat, prefOccasions, prefStyles),
    })).sort((a, b) => b.score - a.score);

    /* Filter out inappropriate items for conditions */
    const filtered = scored.filter(({ item }) => {
      const prot = classifyWeatherProtection(item);
      if ((pCat === "rain" || pCat === "snow" || pCat === "storm") && cat === "Shoes" && prot.openToe) return false;
      if (pCat === "snow" && prot.vulnerableToWet) return false;
      const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
      if (wCat === "hot" && cat === "Outerwear" && pCat === "clear") return false;
      if ((pCat === "snow" || wCat === "cold") && ["shorts", "tank top", "crop top", "sandals"].includes(type)) return false;
      return true;
    });

    const candidates = filtered.length ? filtered : scored;

    /* Pick top items, ensuring variety (no duplicate clothing types) */
    const picked = [];
    const usedTypes = new Set();
    for (const { item } of candidates) {
      if (picked.length >= quota) break;
      const type = normalizeClothingType(item?.clothing_type || item?.type || "");
      /* Allow duplicates only after exhausting unique types */
      if (usedTypes.has(type) && picked.length < Math.min(quota, candidates.length)) {
        /* defer — we might still have unique types */
        continue;
      }
      usedTypes.add(type);
      picked.push(item);
    }
    /* If we still need more, fill from remaining (allow duplicate types) */
    if (picked.length < quota) {
      const pickedIds = new Set(picked.map((x) => (x?.id ?? "").toString()));
      for (const { item } of candidates) {
        if (picked.length >= quota) break;
        const id = (item?.id ?? "").toString();
        if (!pickedIds.has(id)) { picked.push(item); pickedIds.add(id); }
      }
    }

    /* Include mid-layers as separate entries for cold weather */
    if (cat === "Tops" && (wCat === "cold" || wCat === "cool")) {
      const midLayers = (buckets.Tops || []).filter((item) => item.layer_type === "mid");
      const midScored = midLayers
        .map((item) => ({ item, score: scoreItemForPacking(item, wCat, pCat, prefOccasions, prefStyles) }))
        .sort((a, b) => b.score - a.score);
      const midQuota = wCat === "cold" ? Math.min(2, midScored.length) : Math.min(1, midScored.length);
      const pickedIds = new Set(picked.map((x) => (x?.id ?? "").toString()));
      for (const { item } of midScored) {
        if (picked.length >= quota + midQuota) break;
        const id = (item?.id ?? "").toString();
        if (!pickedIds.has(id)) { picked.push(item); pickedIds.add(id); }
      }
    }

    result[cat] = picked.map((item) => ({
      id: (item.id ?? "").toString(),
      name: item.name || "Item",
      category: normalizeCategory(item.category),
      color: titleCase(item.color || ""),
      clothing_type: normalizeClothingType(item.clothing_type || item.type || ""),
      image_url: item.image_url || "",
      layer_type: item.layer_type || "",
    }));
    totalItems += result[cat].length;
  }

  /* Add one-pieces if available and weather-appropriate */
  if (buckets.OnePieces && buckets.OnePieces.length && wCat !== "cold") {
    const opScored = buckets.OnePieces
      .map((item) => ({ item, score: scoreItemForPacking(item, wCat, pCat, prefOccasions, prefStyles) }))
      .sort((a, b) => b.score - a.score);
    const opQuota = Math.min(tripDays <= 3 ? 1 : 2, opScored.length);
    const onePieces = opScored.slice(0, opQuota).map(({ item }) => ({
      id: (item.id ?? "").toString(),
      name: item.name || "Item",
      category: "One-Piece",
      color: titleCase(item.color || ""),
      clothing_type: normalizeClothingType(item.clothing_type || item.type || ""),
      image_url: item.image_url || "",
      layer_type: "",
    }));
    if (onePieces.length) {
      result["One-Piece"] = onePieces;
      totalItems += onePieces.length;
    }
  }

  return {
    categories: result,
    totalItems,
    tripDays,
    weatherCategory: wCat,
    precipCategory: pCat,
  };
}

/* ── Duplicate item detection ─────────────────────────────────────── */

function tokenize(str) {
  return (str || "").toString().toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
}

export function diceSimilarity(a, b) {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (!tokA.length && !tokB.length) return 1;
  if (!tokA.length || !tokB.length) return 0;
  const setA = new Set(tokA);
  const setB = new Set(tokB);
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  return (2 * shared) / (setA.size + setB.size);
}

function tagOverlap(tagsA, tagsB) {
  const a = new Set((Array.isArray(tagsA) ? tagsA : []).map((t) => (t || "").toString().toLowerCase()).filter(Boolean));
  const b = new Set((Array.isArray(tagsB) ? tagsB : []).map((t) => (t || "").toString().toLowerCase()).filter(Boolean));
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

const SIM_WEIGHTS = {
  name: 0.30,
  category: 0.12,
  color: 0.15,
  clothingType: 0.20,
  fit: 0.05,
  styleTags: 0.06,
  occasionTags: 0.04,
  seasonTags: 0.03,
  imageHash: 0.05,
};

export function itemSimilarityScore(a, b) {
  if (!a || !b) return { score: 0, breakdown: {} };

  const normA = typeof a._idx === "number" ? a : createNormalizedItem(a, 0);
  const normB = typeof b._idx === "number" ? b : createNormalizedItem(b, 1);

  const nameScore = diceSimilarity(normA.name, normB.name);
  const categoryScore = normA.category === normB.category ? 1 : 0;
  const colorScore = normalizeColorName(normA.color).toLowerCase() === normalizeColorName(normB.color).toLowerCase() ? 1
    : diceSimilarity(normA.color, normB.color);
  const typeScore = normA.clothing_type === normB.clothing_type ? 1
    : diceSimilarity(normA.clothing_type, normB.clothing_type);
  const fitScore = normA.fit_tag && normB.fit_tag && normA.fit_tag === normB.fit_tag ? 1 : 0;
  const styleScore = tagOverlap(normA.style_tags, normB.style_tags);
  const occasionScore = tagOverlap(normA.occasion_tags, normB.occasion_tags);
  const seasonScore = tagOverlap(normA.season_tags, normB.season_tags);

  /* Placeholder for future ML image comparison — always 0 for now */
  const imageScore = 0;

  const breakdown = {
    name: nameScore,
    category: categoryScore,
    color: colorScore,
    clothingType: typeScore,
    fit: fitScore,
    styleTags: styleScore,
    occasionTags: occasionScore,
    seasonTags: seasonScore,
    imageHash: imageScore,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(SIM_WEIGHTS)) {
    score += (breakdown[key] || 0) * weight;
  }
  /* Normalize to 0-1 (imageHash is always 0, so max possible is 0.95) */
  const maxPossible = Object.values(SIM_WEIGHTS).reduce((s, w) => s + w, 0) - SIM_WEIGHTS.imageHash;
  score = Math.min(1, score / maxPossible);

  return { score: Math.round(score * 100) / 100, breakdown };
}

const DUP_EXACT = 0.92;
const DUP_LIKELY = 0.72;
const DUP_SIMILAR = 0.55;

export function classifyDuplicateLevel(score) {
  if (score >= DUP_EXACT) return "exact";
  if (score >= DUP_LIKELY) return "likely";
  if (score >= DUP_SIMILAR) return "similar";
  return "none";
}

export function detectDuplicates(wardrobeItems, dismissedPairs) {
  const items = (Array.isArray(wardrobeItems) ? wardrobeItems : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );
  const dismissed = dismissedPairs instanceof Set ? dismissedPairs : new Set(Array.isArray(dismissedPairs) ? dismissedPairs : []);

  /* Bucket by category to reduce comparisons */
  const byCategory = {};
  for (const item of items) {
    const cat = normalizeCategory(item?.category);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  const pairs = [];

  for (const pool of Object.values(byCategory)) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const idA = (pool[i]?.id ?? "").toString();
        const idB = (pool[j]?.id ?? "").toString();
        if (!idA || !idB) continue;

        const pairKey = [idA, idB].sort().join("|");
        if (dismissed.has(pairKey)) continue;

        const { score, breakdown } = itemSimilarityScore(pool[i], pool[j]);
        const level = classifyDuplicateLevel(score);
        if (level === "none") continue;

        pairs.push({
          pairKey,
          itemA: pool[i],
          itemB: pool[j],
          score,
          level,
          breakdown,
        });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  return {
    exact: pairs.filter((p) => p.level === "exact"),
    likely: pairs.filter((p) => p.level === "likely"),
    similar: pairs.filter((p) => p.level === "similar"),
    total: pairs.length,
  };
}

/* ── Recommendation feedback learning ─────────────────────────────── */

const FEEDBACK_DECAY_DAYS = 60;
const RECENT_WINDOW_DAYS = 14;
const MAX_FEEDBACK_BIAS = 12;

const DEFAULT_ATTRIBUTE_WEIGHTS = {
  item: 1.5,
  color: 1.0,
  clothingType: 1.0,
  style: 0.8,
};

function aggregateCounts(list, now) {
  const colorCounts = {};
  const typeCounts = {};
  const styleCounts = {};
  const itemCounts = {};

  for (const entry of list) {
    const fb = entry?.feedback;
    if (fb !== "like" && fb !== "dislike") continue;

    const age = entry?.timestamp ? (now - entry.timestamp) / (1000 * 60 * 60 * 24) : 0;
    const weight = age > FEEDBACK_DECAY_DAYS ? 0.3 : age > 30 ? 0.6 : 1;
    const field = fb === "like" ? "liked" : "disliked";

    for (const c of Array.isArray(entry.colors) ? entry.colors : []) {
      const k = (c || "").toLowerCase();
      if (!k) continue;
      if (!colorCounts[k]) colorCounts[k] = { liked: 0, disliked: 0 };
      colorCounts[k][field] += weight;
    }
    for (const t of Array.isArray(entry.clothingTypes) ? entry.clothingTypes : []) {
      const k = (t || "").toLowerCase();
      if (!k) continue;
      if (!typeCounts[k]) typeCounts[k] = { liked: 0, disliked: 0 };
      typeCounts[k][field] += weight;
    }
    for (const s of Array.isArray(entry.styleTags) ? entry.styleTags : []) {
      const k = (s || "").toLowerCase();
      if (!k) continue;
      if (!styleCounts[k]) styleCounts[k] = { liked: 0, disliked: 0 };
      styleCounts[k][field] += weight;
    }
    for (const id of Array.isArray(entry.itemIds) ? entry.itemIds : []) {
      const k = (id || "").toString();
      if (!k) continue;
      if (!itemCounts[k]) itemCounts[k] = { liked: 0, disliked: 0 };
      itemCounts[k][field] += weight;
    }
  }

  return { colorCounts, typeCounts, styleCounts, itemCounts };
}

function computeConfidence(counts) {
  let totalKeys = 0;
  let conflicted = 0;
  for (const val of Object.values(counts)) {
    totalKeys++;
    if (val.liked > 0 && val.disliked > 0) conflicted++;
  }
  if (!totalKeys) return 1;
  return Math.max(0.3, 1 - (conflicted / totalKeys));
}

export function computeAttributeWeights(feedbackList) {
  const list = Array.isArray(feedbackList) ? feedbackList : [];
  if (!list.length) return { ...DEFAULT_ATTRIBUTE_WEIGHTS };

  /* Measure signal strength per attribute: how often does the attribute
     appear in liked entries relative to total likes? Strong signal = the
     user consistently engages with that attribute dimension. */
  const likes = list.filter((e) => e?.feedback === "like");
  const total = Math.max(likes.length, 1);

  let colorSignal = 0;
  let typeSignal = 0;
  let styleSignal = 0;
  let itemSignal = 0;

  for (const entry of likes) {
    if ((entry.colors || []).length) colorSignal++;
    if ((entry.clothingTypes || []).length) typeSignal++;
    if ((entry.styleTags || []).length) styleSignal++;
    if ((entry.itemIds || []).length) itemSignal++;
  }

  /* Scale each weight: default × (0.5 + signal_ratio).
     A dimension seen in every like gets 1.5× its default weight.
     A dimension never present keeps 0.5× its default.
     This ensures all attributes stay active (exploration) while
     boosting the dimensions the user actually engages with. */
  return {
    item:         DEFAULT_ATTRIBUTE_WEIGHTS.item * (0.5 + (itemSignal / total)),
    color:        DEFAULT_ATTRIBUTE_WEIGHTS.color * (0.5 + (colorSignal / total)),
    clothingType: DEFAULT_ATTRIBUTE_WEIGHTS.clothingType * (0.5 + (typeSignal / total)),
    style:        DEFAULT_ATTRIBUTE_WEIGHTS.style * (0.5 + (styleSignal / total)),
  };
}

export function buildFeedbackProfile(feedbackList) {
  const list = Array.isArray(feedbackList) ? feedbackList : [];
  const now = Date.now();

  /* Full history aggregation */
  const allCounts = aggregateCounts(list, now);

  /* Recent window (short-term preferences) */
  const recentCutoff = now - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentList = list.filter((e) => (e?.timestamp || 0) >= recentCutoff);
  const recentCounts = aggregateCounts(recentList, now);

  /* Per-attribute confidence: 1.0 = no conflicts, 0.3 = heavily conflicted */
  const confidence = {
    color:        computeConfidence(allCounts.colorCounts),
    clothingType: computeConfidence(allCounts.typeCounts),
    style:        computeConfidence(allCounts.styleCounts),
    item:         computeConfidence(allCounts.itemCounts),
  };

  /* Adaptive weights from feedback patterns */
  const attributeWeights = computeAttributeWeights(list);

  return {
    colorCounts: allCounts.colorCounts,
    typeCounts: allCounts.typeCounts,
    styleCounts: allCounts.styleCounts,
    itemCounts: allCounts.itemCounts,
    recentCounts,
    confidence,
    attributeWeights,
    totalEntries: list.length,
  };
}

function netPreference(counts) {
  if (!counts) return 0;
  return counts.liked - counts.disliked;
}

function blendedPreference(allCounts, recentCounts, key) {
  const longTerm = netPreference(allCounts[key]);
  const shortTerm = netPreference(recentCounts?.[key]);
  /* Recent feedback gets 60% weight when available, historical 40% */
  if (shortTerm !== 0) return longTerm * 0.4 + shortTerm * 0.6;
  return longTerm;
}

export function feedbackBias(item, profile) {
  if (!profile || !profile.totalEntries) return 0;

  const id = (item?.id ?? "").toString();
  const color = normalizeColorName(item?.color || "").toLowerCase();
  const type = normalizeClothingType(item?.clothing_type || item?.type || item?.name || "");
  const styles = normalizeTagArray(item?.style_tags).map((s) => (s || "").toLowerCase());

  const w = profile.attributeWeights || DEFAULT_ATTRIBUTE_WEIGHTS;
  const conf = profile.confidence || { color: 1, clothingType: 1, style: 1, item: 1 };
  const recent = profile.recentCounts || {};

  let score = 0;

  /* Item-level preference (strongest signal, confidence-scaled) */
  const itemPref = blendedPreference(profile.itemCounts, recent.itemCounts, id);
  score += Math.max(-4, Math.min(4, itemPref * 2)) * w.item * conf.item;

  /* Color preference */
  const colorPref = blendedPreference(profile.colorCounts, recent.colorCounts, color);
  score += Math.max(-3, Math.min(3, colorPref)) * w.color * conf.color;

  /* Clothing type preference */
  const typePref = blendedPreference(profile.typeCounts, recent.typeCounts, type);
  score += Math.max(-3, Math.min(3, typePref)) * w.clothingType * conf.clothingType;

  /* Style tag preference (averaged across tags) */
  if (styles.length) {
    let styleTotal = 0;
    for (const s of styles) styleTotal += blendedPreference(profile.styleCounts, recent.styleCounts, s);
    score += Math.max(-2, Math.min(2, styleTotal / styles.length)) * w.style * conf.style;
  }

  return Math.max(-MAX_FEEDBACK_BIAS, Math.min(MAX_FEEDBACK_BIAS, Math.round(score * 100) / 100));
}

export function measureFeedbackAlignment(feedbackList, wardrobeItems, context) {
  const list = (Array.isArray(feedbackList) ? feedbackList : []).filter((e) => e?.feedback === "like" || e?.feedback === "dislike");
  if (list.length < 3) return { accuracy: null, sampleSize: list.length, message: "Not enough feedback yet." };

  const profile = buildFeedbackProfile(list);
  const items = Array.isArray(wardrobeItems) ? wardrobeItems : [];

  let aligned = 0;
  let total = 0;

  for (const entry of list) {
    const ids = Array.isArray(entry.itemIds) ? entry.itemIds : [];
    const outfitItems = ids.map((id) => items.find((w) => (w?.id ?? "").toString() === id.toString())).filter(Boolean);
    if (!outfitItems.length) continue;

    /* Compute average feedback bias for this outfit's items */
    const avgBias = outfitItems.reduce((sum, it) => sum + feedbackBias(it, profile), 0) / outfitItems.length;

    total++;
    /* Aligned = liked outfit has positive bias, or disliked has negative */
    if ((entry.feedback === "like" && avgBias >= 0) || (entry.feedback === "dislike" && avgBias <= 0)) {
      aligned++;
    }
  }

  const accuracy = total ? Math.round((aligned / total) * 100) : null;
  return {
    accuracy,
    sampleSize: total,
    message: accuracy === null ? "No matchable feedback." : accuracy >= 70 ? "Model is well-aligned with your preferences." : "Model is still learning your preferences.",
  };
}

/* ── Personalization engine ────────────────────────────────────────── */

const SIGNAL_WEIGHT_EXPLICIT = 3;
const SIGNAL_WEIGHT_WORN = 2;
const SIGNAL_WEIGHT_SAVED = 1.5;

function historyToImplicitFeedback(historyList) {
  return (Array.isArray(historyList) ? historyList : []).map((entry) => {
    const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];
    return {
      feedback: "like",
      timestamp: new Date(entry?.worn_at).getTime() || Date.now(),
      itemIds: ids.map((id) => (id ?? "").toString()).filter(Boolean),
      colors: [],
      clothingTypes: [],
      styleTags: [],
      _signalWeight: SIGNAL_WEIGHT_WORN,
    };
  });
}

function savedToImplicitFeedback(savedList) {
  return (Array.isArray(savedList) ? savedList : []).map((entry) => {
    const ids = Array.isArray(entry?.item_ids || entry?.items) ? (entry.item_ids || entry.items) : [];
    return {
      feedback: "like",
      timestamp: new Date(entry?.created_at).getTime() || Date.now(),
      itemIds: ids.map((id) => (id ?? "").toString()).filter(Boolean),
      colors: [],
      clothingTypes: [],
      styleTags: [],
      _signalWeight: SIGNAL_WEIGHT_SAVED,
    };
  });
}

function enrichImplicitFeedback(entries, wardrobeItems) {
  const byId = new Map();
  for (const item of Array.isArray(wardrobeItems) ? wardrobeItems : []) {
    const id = (item?.id ?? "").toString();
    if (id) byId.set(id, item);
  }
  for (const entry of entries) {
    if (entry.colors.length || entry.clothingTypes.length) continue;
    const colors = new Set();
    const types = new Set();
    const styles = new Set();
    for (const id of entry.itemIds) {
      const item = byId.get(id);
      if (!item) continue;
      const c = (item.color || "").toLowerCase();
      if (c) colors.add(c);
      const t = (item.clothing_type || item.type || "").toLowerCase();
      if (t) types.add(t);
      for (const s of Array.isArray(item.style_tags) ? item.style_tags : []) {
        const sv = (s || "").toLowerCase();
        if (sv) styles.add(sv);
      }
    }
    entry.colors = [...colors];
    entry.clothingTypes = [...types];
    entry.styleTags = [...styles];
  }
  return entries;
}

export function buildPersonalizationProfile(feedbackList, historyList, savedList, wardrobeItems) {
  const explicit = (Array.isArray(feedbackList) ? feedbackList : []).map((e) => ({ ...e, _signalWeight: SIGNAL_WEIGHT_EXPLICIT }));
  const worn = enrichImplicitFeedback(historyToImplicitFeedback(historyList), wardrobeItems);
  const saved = enrichImplicitFeedback(savedToImplicitFeedback(savedList), wardrobeItems);

  /* Merge all signals — explicit feedback always takes precedence via ordering */
  const unified = [...explicit, ...worn, ...saved];

  /* Build the core profile using the existing adaptive system */
  const profile = buildFeedbackProfile(unified);

  /* Compute personalization level (0-100) based on data volume + diversity */
  const explicitCount = explicit.length;
  const implicitCount = worn.length + saved.length;
  const totalSignals = explicitCount * SIGNAL_WEIGHT_EXPLICIT + implicitCount;
  const dataScore = Math.min(50, totalSignals * 2);
  const diversityKeys = new Set([
    ...Object.keys(profile.colorCounts),
    ...Object.keys(profile.typeCounts),
    ...Object.keys(profile.styleCounts),
  ]);
  const diversityScore = Math.min(50, diversityKeys.size * 5);
  const level = Math.min(100, Math.round(dataScore + diversityScore));

  /* Exploration factor: high early (lots of randomness), low later (trust the model) */
  const exploration = Math.max(0.1, 1 - (level / 125));

  return {
    ...profile,
    personalizationLevel: level,
    explorationFactor: Math.round(exploration * 100) / 100,
    signalCounts: { explicit: explicitCount, worn: worn.length, saved: saved.length },
  };
}

export function personalizationLevel(profile) {
  return profile?.personalizationLevel ?? 0;
}

export function explorationFactor(profile) {
  return profile?.explorationFactor ?? 1;
}

export function validatePersonalizationProgress(feedbackList, historyList, wardrobeItems) {
  const allFeedback = Array.isArray(feedbackList) ? feedbackList : [];
  const items = Array.isArray(wardrobeItems) ? wardrobeItems : [];

  if (allFeedback.length < 6) {
    return { earlyAccuracy: null, lateAccuracy: null, improved: null, message: "Need at least 6 feedback entries to measure progress." };
  }

  /* Split feedback into early half and full set */
  const sorted = [...allFeedback].sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));
  const midpoint = Math.floor(sorted.length / 2);
  const earlyHalf = sorted.slice(0, midpoint);
  const fullSet = sorted;

  const earlyResult = measureFeedbackAlignment(earlyHalf, items);
  const fullResult = measureFeedbackAlignment(fullSet, items);

  const earlyAcc = earlyResult.accuracy;
  const lateAcc = fullResult.accuracy;
  const improved = earlyAcc !== null && lateAcc !== null ? lateAcc >= earlyAcc : null;

  let message;
  if (earlyAcc === null || lateAcc === null) {
    message = "Not enough matchable feedback to compare.";
  } else if (lateAcc > earlyAcc + 5) {
    message = "Recommendations are improving as you provide more feedback.";
  } else if (lateAcc >= earlyAcc) {
    message = "Recommendation quality is stable.";
  } else {
    message = "Your preferences may be shifting — the model is adapting.";
  }

  return { earlyAccuracy: earlyAcc, lateAccuracy: lateAcc, improved, message };
}

/* ── Wardrobe gap detection ─────────────────────────────────────────── */

const ESSENTIAL_CATEGORIES = ["Tops", "Bottoms", "Shoes"];
const MIN_CATEGORY_COUNT = 2;
const MAX_GAP_SUGGESTIONS = 5;

const OCCASION_CLOTHING = {
  work:     ["dress shirt", "blazer", "dress shoes", "trousers"],
  formal:   ["dress shirt", "blazer", "dress shoes", "dress"],
  athletic: ["tank top", "shorts", "sneakers", "windbreaker"],
  casual:   ["t-shirt", "jeans", "sneakers", "hoodie"],
  social:   ["blouse", "dress", "heels", "cardigan"],
};

const SEASON_CLOTHING = {
  winter: { types: ["coat", "parka", "sweater", "turtleneck", "boots", "scarf"], categories: ["Outerwear"] },
  summer: { types: ["tank top", "shorts", "sandals", "t-shirt"], categories: ["Tops", "Bottoms"] },
  fall:   { types: ["jacket", "cardigan", "boots", "sweater"], categories: ["Outerwear"] },
  spring: { types: ["windbreaker", "cardigan", "sneakers"], categories: ["Outerwear", "Shoes"] },
};

export function analyzeWardrobeGaps(items, answers, weatherCategory) {
  const active = (Array.isArray(items) ? items : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );
  const buckets = bucketWardrobe(active);
  const gaps = [];

  /* 1. Essential category gaps — high priority */
  for (const cat of ESSENTIAL_CATEGORIES) {
    if (!buckets[cat] || buckets[cat].length === 0) {
      gaps.push({
        category: cat,
        suggestion: cat === "Tops" ? "A versatile t-shirt or button-up"
          : cat === "Bottoms" ? "A pair of jeans or chinos"
          : "Sneakers or casual shoes",
        priority: "high",
        reason: `You have no ${cat.toLowerCase()} — every outfit needs one.`,
      });
    }
  }

  /* 2. Category balance — medium priority */
  const catCounts = ESSENTIAL_CATEGORIES.map((cat) => ({ cat, count: (buckets[cat] || []).length }));
  const maxCount = Math.max(...catCounts.map((c) => c.count), 0);
  if (maxCount >= 3) {
    for (const { cat, count } of catCounts) {
      if (count > 0 && count < MIN_CATEGORY_COUNT && count < maxCount / 2) {
        gaps.push({
          category: cat,
          suggestion: `More ${cat.toLowerCase()} to balance your wardrobe`,
          priority: "medium",
          reason: `You have ${count} ${cat.toLowerCase()} but ${maxCount} in another category — adding variety here gives the algorithm more to work with.`,
        });
      }
    }
  }

  /* 3. Occasion coverage — medium priority */
  const preferredOccasions = preferredOccasionsFromAnswers(answers);
  for (const occasion of preferredOccasions) {
    const expectedTypes = OCCASION_CLOTHING[occasion] || [];
    if (!expectedTypes.length) continue;
    const itemTypes = active.map((x) => normalizeClothingType(x?.clothing_type || x?.type || ""));
    const hasMatch = expectedTypes.some((t) => itemTypes.includes(t));
    const taggedForOccasion = active.some((x) => normalizeTagArray(x?.occasion_tags).map(normalizeOccasionValue).includes(occasion));
    if (!hasMatch && !taggedForOccasion) {
      const readable = titleCase(occasion);
      gaps.push({
        category: readable,
        suggestion: `A ${expectedTypes[0]} or ${expectedTypes[1]} for ${readable}`,
        priority: "medium",
        reason: `You dress for ${readable} but don't have typical ${readable.toLowerCase()} pieces yet.`,
      });
    }
  }

  /* 4. Season coverage — medium priority */
  const currentSeason = seasonFromDate(new Date());
  const seasonData = SEASON_CLOTHING[currentSeason];
  if (seasonData) {
    const itemTypes = active.map((x) => normalizeClothingType(x?.clothing_type || x?.type || ""));
    const seasonTagged = active.filter((x) => normalizeTagArray(x?.season_tags).includes(currentSeason));
    const hasSeasonType = seasonData.types.some((t) => itemTypes.includes(t));
    if (!hasSeasonType && seasonTagged.length === 0) {
      gaps.push({
        category: titleCase(currentSeason),
        suggestion: `A ${seasonData.types[0]} or ${seasonData.types[1]} for ${currentSeason}`,
        priority: "medium",
        reason: `It's ${currentSeason} and you don't have season-appropriate pieces.`,
      });
    }
  }

  /* 5. Layer gaps for cold/cool weather — medium priority */
  const wCat = (weatherCategory || "mild").toString().trim().toLowerCase();
  if ((wCat === "cold" || wCat === "cool") && active.length >= 3) {
    const layerTypes = new Set(active.map((x) => normalizeLayerType(x?.layer_type, normalizeClothingType(x?.clothing_type || ""), normalizeCategory(x?.category))).filter(Boolean));
    if (!layerTypes.has("outer") && (buckets.Outerwear || []).length === 0) {
      gaps.push({
        category: "Outerwear",
        suggestion: wCat === "cold" ? "A warm coat or parka" : "A light jacket or cardigan",
        priority: "medium",
        reason: `It's ${wCat} weather and you have no outer layer for warmth.`,
      });
    }
    if (wCat === "cold" && !layerTypes.has("mid")) {
      gaps.push({
        category: "Layers",
        suggestion: "A sweater, hoodie, or fleece as a mid layer",
        priority: "medium",
        reason: "Cold weather works best with a mid layer between your base and outer.",
      });
    }
  }

  /* 6. Color variety — low priority */
  if (active.length >= 4) {
    const colors = active.map((x) => normalizeColorName(x?.color || "")).filter(Boolean);
    const uniqueColors = new Set(colors);
    if (uniqueColors.size === 1) {
      const only = titleCase([...uniqueColors][0]);
      gaps.push({
        category: "Color variety",
        suggestion: `Something in a contrasting color to ${only}`,
        priority: "low",
        reason: `All ${active.length} items are ${only} — adding a second color gives the algorithm more pairing options.`,
      });
    }
  }

  /* Deduplicate by category, keep highest priority */
  const seen = new Set();
  const deduped = [];
  for (const gap of gaps) {
    if (seen.has(gap.category)) continue;
    seen.add(gap.category);
    deduped.push(gap);
  }

  return deduped.slice(0, MAX_GAP_SUGGESTIONS);
}

/* ── Outfit reuse helpers ──────────────────────────────────────────── */

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
