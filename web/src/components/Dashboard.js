// web/src/components/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { loadWardrobe } from "../utils/userStorage";
import { fetchAIRecommendations } from "../api/recommendationsApi";
import { plannedOutfitsApi } from "../api/plannedOutfitsApi";

const OPEN_ADD_ITEM_FLAG = "fitgpt_open_add_item";
const DEFAULT_BODY_TYPE = "rectangle";

const REUSE_OUTFIT_KEY = "fitgpt_reuse_outfit_v1";
const WEATHER_OVERRIDE_KEY = "fitgpt_weather_override_v1";
const TIME_OVERRIDE_KEY = "fitgpt_time_override_v1";

const BODY_TYPE_LABELS = {
  pear: "Pear",
  apple: "Apple",
  hourglass: "Hourglass",
  rectangle: "Rectangle",
  inverted: "Inverted Triangle",
};

const RECENT_N = 10;

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const REC_SEED_KEY = "fitgpt_rec_seed_v1";

function readRecSeed() {
  try {
    const raw = sessionStorage.getItem(REC_SEED_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return Date.now();
}

function writeRecSeed(seed) {
  try {
    sessionStorage.setItem(REC_SEED_KEY, String(seed));
  } catch {}
}

function titleCase(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function normalizeCategory(cat) {
  const c = (cat || "").toString().trim().toLowerCase();
  if (!c) return "";
  if (c === "tops" || c === "top") return "Tops";
  if (c === "bottoms" || c === "bottom") return "Bottoms";
  if (c === "outerwear" || c === "jacket" || c === "coats") return "Outerwear";
  if (c === "shoes" || c === "shoe") return "Shoes";
  if (c === "accessories" || c === "accessory") return "Accessories";
  return titleCase(c);
}

function normalizeColorName(raw) {
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

function colorToCss(colorName) {
  const c = normalizeColorName(colorName).toLowerCase();
  const map = {
    black: "#1a1a1a", white: "#f5f5f5", gray: "#9ca3af", grey: "#9ca3af",
    red: "#dc2626", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308",
    orange: "#f97316", purple: "#a855f7", pink: "#ec4899", brown: "#92400e",
    beige: "#d4c5a9", navy: "#1e3a5f", teal: "#14b8a6", coral: "#f87171",
    gold: "#d97706", olive: "#65a30d", lavender: "#a78bfa", mint: "#34d399",
  };
  return map[c] || "#9ca3af";
}

function normalizeFitTag(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v) return "unspecified";
  const allowed = new Set(["unspecified", "tight", "fitted", "regular", "relaxed", "oversized"]);
  return allowed.has(v) ? v : "unspecified";
}

function fitPenalty(fitTag, bodyTypeId, category) {
  const fit = normalizeFitTag(fitTag);
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

function colorGroup(colorRaw) {
  const c = normalizeColorName(colorRaw);

  const neutrals = new Set(["black", "white", "gray", "grey", "beige", "tan", "cream", "brown", "navy", "denim"]);
  const warms = new Set(["red", "orange", "yellow", "pink", "coral", "peach"]);
  const cools = new Set(["blue", "green", "purple", "teal", "turquoise"]);

  if (!c) return "unknown";
  if (neutrals.has(c)) return "neutral";
  if (warms.has(c)) return "warm";
  if (cools.has(c)) return "cool";
  return "unknown";
}

function pairScore(aColor, bColor) {
  const a = colorGroup(aColor);
  const b = colorGroup(bColor);

  if (a === "neutral" || b === "neutral") return 3;
  if (a === "unknown" || b === "unknown") return 2;
  if (a === b) return 3;
  return 1;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(list, rng) {
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

/* WEATHER */
function weatherCategoryFromTempF(tempF) {
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

function readWeatherOverride() {
  const raw = sessionStorage.getItem(WEATHER_OVERRIDE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const v = (parsed ?? raw ?? "").toString().trim().toLowerCase();
  const allowed = new Set(["cold", "cool", "mild", "warm", "hot"]);
  return allowed.has(v) ? v : "";
}

function writeWeatherOverride(nextOrEmpty) {
  const v = (nextOrEmpty || "").toString().trim().toLowerCase();
  if (!v) {
    sessionStorage.removeItem(WEATHER_OVERRIDE_KEY);
    return;
  }
  sessionStorage.setItem(WEATHER_OVERRIDE_KEY, JSON.stringify(v));
}

async function getWeatherFromLocation() {
  const pos = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location not available."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => reject(new Error("Location blocked.")),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });

  const lat = pos?.coords?.latitude;
  const lon = pos?.coords?.longitude;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Location not available.");
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    lat
  )}&longitude=${encodeURIComponent(lon)}&current=temperature_2m&temperature_unit=fahrenheit`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather unavailable.");

  const json = await res.json();
  const tempF = json?.current?.temperature_2m;
  const category = weatherCategoryFromTempF(tempF);

  return {
    tempF: Number.isFinite(Number(tempF)) ? Math.round(Number(tempF)) : null,
    category,
  };
}

/* TIME OF DAY */
function timeCategoryFromDate(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date();
  const h = d.getHours(); // 0-23 local time

  if (!Number.isFinite(h)) return "work hours";

  if (h >= 5 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "work hours";
  if (h >= 18 && h <= 21) return "evening";
  return "night";
}

function readTimeOverride() {
  const raw = sessionStorage.getItem(TIME_OVERRIDE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const v = (parsed ?? raw ?? "").toString().trim().toLowerCase();
  const allowed = new Set(["morning", "work hours", "evening", "night"]);
  return allowed.has(v) ? v : "";
}

function writeTimeOverride(nextOrEmpty) {
  const v = (nextOrEmpty || "").toString().trim().toLowerCase();
  if (!v) {
    sessionStorage.removeItem(TIME_OVERRIDE_KEY);
    return;
  }
  sessionStorage.setItem(TIME_OVERRIDE_KEY, JSON.stringify(v));
}

function hasOccasionSelected(answers) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  return dressFor.length > 0;
}

function timeScoreBias(timeCatRaw, itemCategory, answers) {
  const timeCat = (timeCatRaw || "work hours").toString().trim().toLowerCase();
  const c = normalizeCategory(itemCategory);

  const occasionSelected = hasOccasionSelected(answers);
  const strength = occasionSelected ? 0.6 : 1; // occasion is primary, time refines

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

    // night
    if (c === "Outerwear") return -2;
    if (c === "Accessories") return -1;
    return 1;
  })();

  return Math.round(base * strength);
}

function bestMatch(primaryItem, candidates, rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers) {
  if (!primaryItem) return pickOne(candidates, rng);
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const primaryColor = primaryItem?.color;

  const scoreFn = (c) => {
    const color = pairScore(primaryColor, c?.color);
    const pen = fitPenalty(c?.fit_tag, bodyTypeId, c?.category);

    const id = (c?.id ?? "").toString().trim();
    const freq = id && recentItemCounts ? recentItemCounts.get(id) || 0 : 0;

    const wBias = weatherScoreBias(weatherCat, c?.category);
    const tBias = timeScoreBias(timeCat, c?.category, answers);

    return color * 10 - pen - freq * 2 + wBias + tBias;
  };

  return pickBestByScore(candidates, scoreFn, rng);
}

function bucketWardrobe(activeItems) {
  const pool = (Array.isArray(activeItems) ? activeItems : []).map((x, idx) => ({
    ...x,
    _idx: idx,
    category: normalizeCategory(x?.category),
    color: titleCase(normalizeColorName(x?.color || "")),
    name: x?.name || "Wardrobe item",
    fit_tag: normalizeFitTag(x?.fit_tag || x?.fitTag || x?.fit),
  }));

  const byCat = { Tops: [], Bottoms: [], Shoes: [], Outerwear: [], Other: [] };

  for (const item of pool) {
    if (item.category === "Tops") byCat.Tops.push(item);
    else if (item.category === "Bottoms") byCat.Bottoms.push(item);
    else if (item.category === "Shoes") byCat.Shoes.push(item);
    else if (item.category === "Outerwear") byCat.Outerwear.push(item);
    else byCat.Other.push(item);
  }

  return byCat;
}

function defaultOutfitSet(seedNumber) {
  const base = [
    { id: "d1", name: "Navy Blazer", color: "Navy", category: "Outerwear" },
    { id: "d2", name: "White Button-Up", color: "White", category: "Tops" },
    { id: "d3", name: "Gray Trousers", color: "Gray", category: "Bottoms" },
    { id: "d4", name: "Black Oxfords", color: "Black", category: "Shoes" },
  ];

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

  const make = () => {
    const top = pickOne(altTops, rng);
    const bottom = bestMatch(top, altBottoms, rng, DEFAULT_BODY_TYPE, null, "mild", "work hours", null);
    const shoes = bestMatch(bottom || top, altShoes, rng, DEFAULT_BODY_TYPE, null, "mild", "work hours", null);

    const outer = base[0];

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

function signatureFromItems(items) {
  const ids = savedOutfitsApi.normalizeItems((items || []).map((x) => x?.id));
  return ids.join("|");
}

function idsSignature(ids) {
  const normalized = savedOutfitsApi.normalizeItems(ids || []);
  return normalized.join("|");
}

function makeRecentSets(historyList) {
  const sigs = new Set();
  const itemCounts = new Map();

  const recent = (Array.isArray(historyList) ? historyList : []).slice(0, RECENT_N);

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

function generateThreeOutfits(items, seedNumber, bodyTypeId, recentExactSigs, recentItemCounts, weatherCat, timeCat, answers) {
  const active = (Array.isArray(items) ? items : []).filter((x) => x && x.is_active !== false);

  if (active.length === 0) {
    return defaultOutfitSet(seedNumber);
  }

  const seed = typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const buckets = bucketWardrobe(active);

  // Fisher-Yates shuffle using provided RNG
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  const rng = mulberry32(seed);

  const includeOuterwear = (weatherCat === "cold" || weatherCat === "cool") && buckets.Outerwear.length > 0;
  const includeOther = buckets.Other.length > 0;

  // Track items used as "anchors" across outfits to encourage variety
  const usedTopIds = new Set();

  const results = [];

  for (let optIdx = 0; optIdx < 3; optIdx++) {
    const outfitItems = [];

    // Pick anchor top — shuffle, then prefer one not yet used as anchor
    const shuffledTops = shuffle(buckets.Tops, rng);
    const unusedTop = shuffledTops.find((t) => !usedTopIds.has(t.id));
    const top = unusedTop || shuffledTops[0] || null;
    if (top) {
      usedTopIds.add(top.id);
      outfitItems.push(top);
    }

    // Score-based picking for remaining categories
    const anchor = top || outfitItems[0] || null;

    const bottom = bestMatch(anchor, shuffle(buckets.Bottoms, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
    if (bottom) outfitItems.push(bottom);

    const shoes = bestMatch(bottom || anchor, shuffle(buckets.Shoes, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
    if (shoes) outfitItems.push(shoes);

    if (includeOuterwear) {
      const outer = bestMatch(anchor, shuffle(buckets.Outerwear, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
      if (outer) outfitItems.push(outer);
    }

    if (includeOther) {
      const accessory = bestMatch(anchor, shuffle(buckets.Other, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
      if (accessory) outfitItems.push(accessory);
    }

    const mapped = outfitItems.map((x, i) => ({
      id: x.id ?? `w${i}_${x._idx}`,
      name: x.name ?? "Wardrobe item",
      category: normalizeCategory(x.category),
      color: titleCase(x.color || ""),
      fit_tag: normalizeFitTag(x.fit_tag),
      image_url: x.image_url || "",
    }));

    if (mapped.length) {
      results.push(mapped);
    }
  }

  // Always return exactly 3 options; pad by cloning if needed
  if (!results.length) return defaultOutfitSet(seedNumber);
  while (results.length < 3) {
    results.push(results[results.length - 1]);
  }

  return results.slice(0, 3);
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

function fitFocusSentence(bodyTypeId) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();

  if (id === "pear") return "Fit focus: add structure on top and keep balance through the hips.";
  if (id === "apple") return "Fit focus: clean lines and comfort through the middle with light structure.";
  if (id === "hourglass") return "Fit focus: highlight the waist while keeping proportions even.";
  if (id === "inverted") return "Fit focus: balance the shoulders with a bit more volume below.";
  return "Fit focus: add shape with layers and contrast.";
}

function bodyTypeLabelFromId(bodyTypeId) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();
  return BODY_TYPE_LABELS[id] || titleCase(id);
}

function buildExplanation1to2Sentences({ answers, outfit }) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  const style = Array.isArray(answers?.style) ? answers.style : [];

  const bodyTypeId = answers?.bodyType ? answers.bodyType : DEFAULT_BODY_TYPE;

  const occasion = dressFor.length ? titleCase(dressFor[0]) : "your day";
  const styleHint = style.length ? titleCase(style[0]) : "";

  const colors = uniqueNonEmpty((outfit || []).map((x) => x?.color));
  const categories = uniqueNonEmpty((outfit || []).map((x) => normalizeCategory(x?.category)));

  const colorPart = colors.length
    ? `The colors (${colors.slice(0, 3).join(", ")}) work well together.`
    : "The colors work well together.";

  const occasionPart = styleHint
    ? `It fits ${occasion} with a ${styleHint.toLowerCase()} feel.`
    : `It fits ${occasion} comfortably.`;

  const fitPart = `It’s chosen to flatter a ${bodyTypeLabelFromId(bodyTypeId)} shape.`;

  const hasOutfit = Array.isArray(outfit) && outfit.length > 0;
  const fallback = "Pick a style and an occasion in onboarding to get a personalized explanation.";

  if (!hasOutfit) return fallback;

  const sentence1 = `${occasionPart} ${colorPart}`.trim();

  const mentionsCategories =
    categories.length >= 2 ? `You’ve got a good mix of ${categories.slice(0, 3).join(", ")}.` : "";

  const sentence2 = [fitPart, mentionsCategories].filter(Boolean).join(" ").trim();
  const sentence3 = fitFocusSentence(bodyTypeId);

  return [sentence1, sentence2, sentence3].filter(Boolean).join(" ").trim();
}

function readReuseOutfit() {
  const raw = sessionStorage.getItem(REUSE_OUTFIT_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed || !Array.isArray(parsed.items)) return null;

  const ids = parsed.items.map((x) => (x ?? "").toString().trim()).filter(Boolean);
  const normalized = savedOutfitsApi.normalizeItems(ids);

  if (!normalized.length) return null;

  return {
    items: normalized,
    saved_outfit_id: (parsed.saved_outfit_id || "").toString(),
  };
}

function clearReuseOutfit() {
  sessionStorage.removeItem(REUSE_OUTFIT_KEY);
}

function buildOutfitFromIds(ids, wardrobe) {
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

export default function Dashboard({ answers, onResetOnboarding = () => {} }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [wardrobe, setWardrobe] = useState(() => loadWardrobe(user));
  const [recSeed, setRecSeed] = useState(() => readRecSeed());

  const [saveMsg, setSaveMsg] = useState("");
  const [savingSig, setSavingSig] = useState("");
  const [savedSigs, setSavedSigs] = useState(() => new Set());

  const [recentExactSigs, setRecentExactSigs] = useState(() => new Set());
  const [recentItemCounts, setRecentItemCounts] = useState(() => new Map());

  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherMsg, setWeatherMsg] = useState("");
  const [weatherTempF, setWeatherTempF] = useState(null);
  const [weatherCategory, setWeatherCategory] = useState(() => readWeatherOverride() || "mild");
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);

  const [timeCategory, setTimeCategory] = useState(() => readTimeOverride() || timeCategoryFromDate(new Date()));
  const [showTimePicker, setShowTimePicker] = useState(false);

  // AI recommendation state
  const [aiOutfits, setAiOutfits] = useState(null);
  const [aiExplanations, setAiExplanations] = useState([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSource, setAiSource] = useState("local");
  const [aiRefreshToken, setAiRefreshToken] = useState(0);
  const [aiHasResolved, setAiHasResolved] = useState(false);

  const [upcomingPlan, setUpcomingPlan] = useState(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planDate, setPlanDate] = useState("");
  const [planOccasion, setPlanOccasion] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  // Persist recSeed so recommendations survive navigation
  useEffect(() => {
    writeRecSeed(recSeed);
  }, [recSeed]);

  useEffect(() => {
    setWardrobe(loadWardrobe(user));
  }, [user]);

  useEffect(() => {
    const refresh = () => setWardrobe(loadWardrobe(user));

    const onStorage = (e) => {
      if (e.key?.startsWith("fitgpt_wardrobe") || e.key?.startsWith("fitgpt_guest_wardrobe")) refresh();
    };

    const onFocus = () => refresh();

    // Always refresh on wardrobe change, regardless of auth state
    const onGuestWardrobeChanged = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("fitgpt:guest-wardrobe-changed", onGuestWardrobeChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("fitgpt:guest-wardrobe-changed", onGuestWardrobeChanged);
    };
  }, [user]);

  useEffect(() => {
    let alive = true;

    async function loadUpcomingPlan() {
      try {
        const res = await plannedOutfitsApi.listPlanned(user);
        const list = Array.isArray(res?.planned_outfits) ? res.planned_outfits : [];

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const limit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const upcoming = list
          .filter((p) => {
            const d = (p?.planned_date || "").toString();
            return d >= todayStr && d <= limit;
          })
          .sort((a, b) => (a?.planned_date || "").localeCompare(b?.planned_date || ""));

        if (alive) setUpcomingPlan(upcoming.length > 0 ? upcoming[0] : null);
      } catch {
        if (alive) setUpcomingPlan(null);
      }
    }

    loadUpcomingPlan();

    const onPlannedChange = () => loadUpcomingPlan();
    window.addEventListener("fitgpt:planned-outfits-changed", onPlannedChange);

    return () => {
      alive = false;
      window.removeEventListener("fitgpt:planned-outfits-changed", onPlannedChange);
    };
  }, [user]);

  useEffect(() => {
    let alive = true;

    async function loadSavedSigs() {
      if (!user) {
        if (alive) setSavedSigs(new Set());
        return;
      }

      try {
        const res = await savedOutfitsApi.listSaved(user);
        const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];

        const sigs = new Set(list.map((o) => (o?.outfit_signature || "").toString().trim()).filter(Boolean));

        if (alive) setSavedSigs(sigs);
      } catch {
        if (alive) setSavedSigs(new Set());
      }
    }

    loadSavedSigs();

    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;

    async function loadRecentHistory() {
      try {
        const res = await outfitHistoryApi.listHistory(user);
        const list = Array.isArray(res?.history) ? res.history : [];

        const sorted = [...list].sort((a, b) => {
          const da = (a?.worn_at || "").toString();
          const db = (b?.worn_at || "").toString();
          return db.localeCompare(da);
        });

        const recentSets = makeRecentSets(sorted);

        if (!alive) return;
        setRecentExactSigs(recentSets.sigs);
        setRecentItemCounts(recentSets.itemCounts);
      } catch {
        if (!alive) return;
        setRecentExactSigs(new Set());
        setRecentItemCounts(new Map());
      }
    }

    loadRecentHistory();

    return () => {
      alive = false;
    };
  }, [user]);

  const loadWeather = async () => {
    const override = readWeatherOverride();
    if (override) {
      setWeatherCategory(override);
      setWeatherMsg("");
      return;
    }

    setWeatherLoading(true);
    setWeatherMsg("");

    try {
      const w = await getWeatherFromLocation();
      setWeatherTempF(w.tempF);
      setWeatherCategory(w.category);
      setWeatherMsg("");
    } catch {
      setWeatherTempF(null);
      setWeatherCategory("mild");
      setWeatherMsg("Weather unavailable, using default recommendations.");
    } finally {
      setWeatherLoading(false);
    }
  };

  const loadTime = () => {
    const override = readTimeOverride();
    if (override) {
      setTimeCategory(override);
      return;
    }

    const detected = timeCategoryFromDate(new Date());
    setTimeCategory(detected || "work hours");
  };

  useEffect(() => {
    loadWeather();
    loadTime();

    const onFocus = () => {
      loadWeather();
      loadTime();
    };
    window.addEventListener("focus", onFocus);

    const weatherIntervalId = window.setInterval(() => loadWeather(), 10 * 60 * 1000);
    const timeIntervalId = window.setInterval(() => loadTime(), 60 * 1000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(weatherIntervalId);
      window.clearInterval(timeIntervalId);
    };

  }, []);

  // Fetch AI recommendations in background (debounced to avoid re-fires on mount)
  useEffect(() => {
    let alive = true;

    const timerId = setTimeout(() => {
      async function fetchAI() {
        const active = (Array.isArray(wardrobe) ? wardrobe : []).filter(
          (x) => x && x.is_active !== false
        );
        if (active.length < 2) {
          if (alive) {
            setAiOutfits(null);
            setAiSource("local");
            setAiLoading(false);
            setAiHasResolved(true);
          }
          return;
        }

        setAiLoading(true);

        try {
          const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
          const style = Array.isArray(answers?.style) ? answers.style : [];

          const context = {
            weather_category: weatherCategory || "mild",
            time_category: timeCategory || "work hours",
            body_type: answers?.bodyType || DEFAULT_BODY_TYPE,
            occasion: dressFor.length ? dressFor[0] : "daily",
            style_preferences: style,
          };

          const res = await fetchAIRecommendations(active, context);

          if (!alive) return;

          if (res?.source === "ai" && Array.isArray(res.outfits) && res.outfits.length > 0) {
            const byId = new Map(active.map((x) => [(x?.id ?? "").toString(), x]));

            const resolved = res.outfits.map((o) => {
              const ids = Array.isArray(o?.item_ids) ? o.item_ids : [];
              return ids
                .map((id) => {
                  const found = byId.get(id.toString());
                  if (!found) return null;
                  return {
                    id: found.id ?? id,
                    name: found.name || "Wardrobe item",
                    category: normalizeCategory(found.category),
                    color: titleCase(normalizeColorName(found.color || "")),
                    fit_tag: normalizeFitTag(found.fit_tag || found.fitTag || found.fit),
                    image_url: found.image_url || "",
                  };
                })
                .filter(Boolean);
            }).filter((outfit) => outfit.length >= 2);

            if (resolved.length > 0) {
              setAiOutfits(resolved.slice(0, 3));
              setAiExplanations(res.outfits.slice(0, 3).map((o) => o?.explanation || ""));
              setAiSource("ai");
            } else {
              setAiOutfits(null);
              setAiSource("local");
            }
          } else {
            setAiOutfits(null);
            setAiSource("local");
          }
        } catch {
          if (alive) {
            setAiOutfits(null);
            setAiSource("local");
          }
        } finally {
          if (alive) {
            setAiLoading(false);
            setAiHasResolved(true);
          }
        }
      }

      fetchAI();
    }, 150);

    return () => {
      alive = false;
      clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe, weatherCategory, timeCategory, answers, aiRefreshToken]);

  const bodyTypeId = answers?.bodyType ? answers.bodyType : DEFAULT_BODY_TYPE;

  const generatedOutfits = useMemo(
    () =>
      generateThreeOutfits(
        wardrobe,
        recSeed,
        bodyTypeId,
        recentExactSigs,
        recentItemCounts,
        weatherCategory,
        timeCategory,
        answers
      ),
    [wardrobe, recSeed, bodyTypeId, recentExactSigs, recentItemCounts, weatherCategory, timeCategory, answers]
  );

  const reused = useMemo(() => readReuseOutfit(), []);

  const outfits = useMemo(() => {
    if (reused) {
      const reusedOutfit = buildOutfitFromIds(reused.items, wardrobe);
      const rest = generatedOutfits.slice(0, 2);
      return [reusedOutfit, ...rest].slice(0, 3);
    }

    // Prefer AI outfits when available
    if (aiOutfits && aiOutfits.length > 0) {
      // Pad with local outfits if AI returned fewer than 3
      const padded = [...aiOutfits];
      let localIdx = 0;
      while (padded.length < 3 && localIdx < generatedOutfits.length) {
        padded.push(generatedOutfits[localIdx++]);
      }
      return padded.slice(0, 3);
    }

    return generatedOutfits;
  }, [generatedOutfits, reused, wardrobe, aiOutfits]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  const explanationText = useMemo(() => {
    // Use AI explanation if available for this outfit index
    if (aiSource === "ai" && !reused && aiExplanations[selectedIdx]) {
      return aiExplanations[selectedIdx];
    }

    const activeOutfit = outfits[selectedIdx] || outfits[0] || [];
    const text = buildExplanation1to2Sentences({ answers, outfit: activeOutfit });
    const cleaned = (text || "").toString().trim();
    return cleaned || "Pick a style and an occasion in onboarding to get a personalized explanation.";
  }, [answers, outfits, selectedIdx, aiSource, aiExplanations, reused]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [answers]);

  const canRefresh = true;

  const handleRefreshRecommendation = () => {
    clearReuseOutfit();
    setSelectedIdx(0);
    // New seed for local fallback (only used if AI fails)
    setRecSeed((prev) => prev + Math.floor(Math.random() * 100000) + 1);
    // Keep current AI outfits visible while new ones load —
    // only clear source/explanations so the word animation replays
    setAiExplanations([]);
    setAiRefreshToken((prev) => prev + 1);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      if (typeof setUser === "function") setUser(null);
      navigate("/auth", { replace: true });
    }
  };

  const goAddItem = () => {
    sessionStorage.setItem(OPEN_ADD_ITEM_FLAG, "1");
    navigate("/wardrobe");
  };

  const openPlanModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setPlanDate(`${yyyy}-${mm}-${dd}`);
    setPlanOccasion("");
    setShowPlanModal(true);
  };

  const handlePlanSave = async () => {
    if (!planDate) {
      setSaveMsg("Please pick a date.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    const outfit = outfits[selectedIdx] || outfits[0] || [];
    if (!outfit.length) return;

    setPlanSaving(true);

    const itemIds = outfit.map((x) => x?.id).filter(Boolean);
    const itemDetails = outfit.map((x) => ({
      id: (x?.id ?? "").toString(),
      name: x?.name || "",
      category: x?.category || "",
      color: x?.color || "",
      image_url: x?.image_url || "",
    }));

    try {
      await plannedOutfitsApi.planOutfit({
        item_ids: itemIds,
        item_details: itemDetails,
        planned_date: planDate,
        occasion: planOccasion,
        source: "planner",
      }, user);

      setSaveMsg("Outfit planned!");
      window.setTimeout(() => setSaveMsg(""), 2500);
      setShowPlanModal(false);
    } catch {
      setSaveMsg("Could not save plan.");
      window.setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setPlanSaving(false);
    }
  };

  const handleWearPlanNow = () => {
    if (!upcomingPlan) return;
    const itemIds = Array.isArray(upcomingPlan.item_ids) ? upcomingPlan.item_ids : [];
    if (!itemIds.length) return;
    const normalized = savedOutfitsApi.normalizeItems(itemIds);
    sessionStorage.setItem(
      REUSE_OUTFIT_KEY,
      JSON.stringify({ items: normalized, saved_outfit_id: upcomingPlan.planned_id || "" })
    );
    window.location.reload();
  };

  function outfitSignature(outfit) {
    const ids = savedOutfitsApi.normalizeItems((outfit || []).map((x) => x?.id));
    return ids.join("|");
  }

  async function recordOutfitInHistory(outfit, source) {
    const itemIds = (outfit || []).map((x) => x?.id).filter(Boolean);
    const normalized = savedOutfitsApi.normalizeItems(itemIds);
    if (!normalized.length) return;

    try {
      await outfitHistoryApi.recordWorn({
        user,
        item_ids: normalized,
        source: source || "recommendation",
        context: {
          occasion: chipText,
          weather_range: weatherCategory,
          temperature_f: weatherTempF,
          time_of_day: timeCategory,
        },
        confidence_score: null,
      }, user);

      const res = await outfitHistoryApi.listHistory(user);
      const list = Array.isArray(res?.history) ? res.history : [];
      const sorted = [...list].sort((a, b) => {
        const da = (a?.worn_at || "").toString();
        const db = (b?.worn_at || "").toString();
        return db.localeCompare(da);
      });

      const recentSets = makeRecentSets(sorted);
      setRecentExactSigs(recentSets.sigs);
      setRecentItemCounts(recentSets.itemCounts);
    } catch {
      
    }
  }

  async function handleSaveOutfit(outfit) {
    const itemIds = (outfit || []).map((x) => x?.id).filter(Boolean);
    const normalized = savedOutfitsApi.normalizeItems(itemIds);
    const sig = normalized.join("|");

    if (!sig) {
      setSaveMsg("Nothing to save yet.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    if (savedSigs.has(sig)) {
      setSavingSig(sig);
      try {
        await savedOutfitsApi.unsaveOutfit(sig, user);
        await outfitHistoryApi.removeBySignature(sig, user);
        setSavedSigs((prev) => {
          const next = new Set(prev);
          next.delete(sig);
          return next;
        });
        setSaveMsg("Removed from saved outfits.");
        window.setTimeout(() => setSaveMsg(""), 2500);
      } catch (e) {
        setSaveMsg(e?.message || "Could not unsave outfit.");
        window.setTimeout(() => setSaveMsg(""), 2500);
      } finally {
        setSavingSig("");
      }
      return;
    }

    setSavingSig(sig);

    try {
      const itemDetails = (outfit || []).map((x) => ({
        id: (x?.id ?? "").toString(),
        name: x?.name || "",
        category: x?.category || "",
        color: x?.color || "",
        image_url: x?.image_url || "",
      }));

      const res = await savedOutfitsApi.saveOutfit({
        items: normalized,
        item_details: itemDetails,
        source: "recommended",
        context: {
          occasion: chipText,
          temperature_category: weatherCategory,
          temperature_f: weatherTempF,
          time_of_day: timeCategory,
        },
      }, user);

      const created = res?.created === true;
      const msg = (res?.message || "").toString().trim();

      setSavedSigs((prev) => {
        const next = new Set(prev);
        next.add(sig);
        return next;
      });

      if (msg) setSaveMsg(msg);
      else setSaveMsg(created ? "Saved." : "This outfit is already in your saved outfits.");

      window.setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) {
      setSaveMsg(e?.message || "Could not save outfit.");
      window.setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setSavingSig("");
    }
  }

  const weatherLine = useMemo(() => {
    const tempPart = Number.isFinite(Number(weatherTempF)) ? `${weatherTempF}°F` : "";
    const catPart = weatherCategory ? titleCase(weatherCategory) : "";
    const parts = [tempPart, catPart].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Weather";
  }, [weatherTempF, weatherCategory]);

  const timeLine = useMemo(() => {
    const t = (timeCategory || "").toString().trim();
    return t ? titleCase(t) : "Work Hours";
  }, [timeCategory]);

  const applyWeatherOverride = (next) => {
    const v = (next || "").toString().trim().toLowerCase();
    if (!v) {
      writeWeatherOverride("");
      setShowWeatherPicker(false);
      loadWeather();
      return;
    }
    writeWeatherOverride(v);
    setWeatherCategory(v);
    setShowWeatherPicker(false);
    setWeatherMsg("");
  };

  const applyTimeOverride = (next) => {
    const v = (next || "").toString().trim().toLowerCase();
    if (!v) {
      writeTimeOverride("");
      setShowTimePicker(false);
      loadTime();
      return;
    }
    writeTimeOverride(v);
    setTimeCategory(v);
    setShowTimePicker(false);
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="dashHeaderBar">
        <div className="brandBar" style={{ marginBottom: 0 }}>
          <div className="brandLeft">
            <div className="brandMark brandMarkSm">
              <img className="dashLogo" src="/officialLogo.png" alt="FitGPT official logo" />
            </div>
            <div className="dashStrong">FitGPT</div>
          </div>
        </div>

        <div className="dashHeaderRight">
          {user ? (
            <button type="button" className="btn" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => navigate("/auth")}>
              Sign in to save
            </button>
          )}
        </div>
      </div>

      <div className="dashTopRightDate">{formatToday()}</div>

      <section className="card dashWide dashWeatherCard">
        <div className="dashWeatherHud">
          <div className="dashWeatherMain">
            <span className="dashWeatherEmoji">
              {weatherCategory === "cold" ? "\u2744\uFE0F" :
               weatherCategory === "cool" ? "\uD83C\uDF2C\uFE0F" :
               weatherCategory === "warm" ? "\u2600\uFE0F" :
               weatherCategory === "hot" ? "\uD83D\uDD25" : "\u26C5"}
            </span>
            <div className="dashWeatherInfo">
              <div className="dashWeatherTemp">
                {Number.isFinite(Number(weatherTempF)) ? `${weatherTempF}\u00B0F` : titleCase(weatherCategory)}
              </div>
              <div className="dashWeatherLabel">
                {Number.isFinite(Number(weatherTempF)) ? titleCase(weatherCategory) : "Today's Weather"}
              </div>
            </div>
          </div>

          <div className="dashWeatherChips">
            <button
              type="button"
              className={"dashContextChip" + (showWeatherPicker ? " active" : "")}
              onClick={() => { setShowWeatherPicker((p) => !p); setShowTimePicker(false); }}
            >
              <span className="dashContextChipIcon">{"\u2601\uFE0F"}</span>
              <span>{titleCase(weatherCategory)}</span>
            </button>

            <button
              type="button"
              className={"dashContextChip" + (showTimePicker ? " active" : "")}
              onClick={() => { setShowTimePicker((p) => !p); setShowWeatherPicker(false); }}
            >
              <span className="dashContextChipIcon">{"\uD83D\uDD52"}</span>
              <span>{timeLine}</span>
            </button>
          </div>
        </div>

        {weatherLoading ? (
          <div className="dashWeatherStatus">Detecting weather...</div>
        ) : null}
        {weatherMsg && !weatherLoading ? (
          <div className="dashWeatherStatus">{weatherMsg}</div>
        ) : null}

        {showWeatherPicker ? (
          <div className="dashContextPicker">
            {["", "cold", "cool", "mild", "warm", "hot"].map((val) => {
              const current = readWeatherOverride() || "";
              const isActive = val === current;
              const label = val ? titleCase(val) : "Live Weather";
              return (
                <button
                  key={val}
                  type="button"
                  className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                  onClick={() => applyWeatherOverride(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {showTimePicker ? (
          <div className="dashContextPicker">
            {["", "morning", "work hours", "evening", "night"].map((val) => {
              const current = readTimeOverride() || "";
              const isActive = val === current;
              const label = val ? titleCase(val) : "System Time";
              return (
                <button
                  key={val}
                  type="button"
                  className={"dashContextPickerBtn" + (isActive ? " active" : "")}
                  onClick={() => applyTimeOverride(val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {upcomingPlan && (() => {
        const details = Array.isArray(upcomingPlan.item_details) ? upcomingPlan.item_details : [];
        const previewIds = Array.isArray(upcomingPlan.item_ids) ? upcomingPlan.item_ids.slice(0, 4) : [];
        const wardrobeMap = new Map(
          (Array.isArray(wardrobe) ? wardrobe : []).map((x) => [(x?.id ?? "").toString().trim(), x])
        );
        const dateLabel = (() => {
          try {
            return new Date(upcomingPlan.planned_date + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "short", month: "short", day: "numeric",
            });
          } catch { return upcomingPlan.planned_date; }
        })();

        return (
          <section className="card dashWide upcomingPlanCard">
            <div className="upcomingPlanHeader">
              <div>
                <div className="upcomingPlanTitle">Upcoming Plan</div>
                <div className="upcomingPlanMeta">
                  {dateLabel}
                  {upcomingPlan.occasion ? ` \u2022 ${upcomingPlan.occasion}` : ""}
                </div>
              </div>
              <span className="historyBadge planned">Planned</span>
            </div>

            <div className="upcomingPlanItems">
              {details.length > 0
                ? details.slice(0, 4).map((d, idx) => (
                    <div key={`up_d_${idx}`} className="upcomingPlanItem">
                      {d?.image_url ? (
                        <img className="upcomingPlanItemImg" src={d.image_url} alt={d?.name || "Item"} />
                      ) : (
                        <div className="upcomingPlanItemPh" />
                      )}
                      <span className="upcomingPlanItemName">{d?.name || "Item"}</span>
                    </div>
                  ))
                : previewIds.map((id, idx) => {
                    const item = wardrobeMap.get((id ?? "").toString().trim());
                    return (
                      <div key={`up_i_${idx}`} className="upcomingPlanItem">
                        {item?.image_url ? (
                          <img className="upcomingPlanItemImg" src={item.image_url} alt={item?.name || "Item"} />
                        ) : (
                          <div className="upcomingPlanItemPh" />
                        )}
                        <span className="upcomingPlanItemName">{item?.name || "Item"}</span>
                      </div>
                    );
                  })}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" onClick={handleWearPlanNow}>
                Wear This Now
              </button>
              <button type="button" className="btn" onClick={() => navigate("/plans")}>
                View All Plans
              </button>
            </div>
          </section>
        );
      })()}

      <section className="card dashWide dashRecCard">
        <div className="dashRecHeader">
          <div className="dashRecHeaderLeft">
            <div className="dashRecTitle">Today’s Recommendation</div>
            {reused ? (
              <div className="dashMuted" style={{ fontSize: 12, marginTop: 4 }}>
                Reused from saved outfits
              </div>
            ) : null}
          </div>
          <div className="dashChip">{chipText}</div>
          <div className="dashRecActions">
            <button type="button" className="btn primary dashRecActionBtn" onClick={handleRefreshRecommendation} disabled={!canRefresh}>
              Refresh
            </button>
            <button type="button" className="btn dashRecActionBtn" onClick={() => {
              const outfit = outfits[selectedIdx] || outfits[0] || [];
              if (!outfit.length) return;
              const lines = outfit.map((item) => `${item.name}${item.color ? ` (${item.color})` : ""}`);
              const text = `My FitGPT Outfit:\n${lines.join("\n")}`;
              navigator.clipboard.writeText(text).then(() => {
                setSaveMsg("Outfit copied to clipboard!");
                window.setTimeout(() => setSaveMsg(""), 2500);
              }).catch(() => {
                setSaveMsg("Could not copy to clipboard.");
                window.setTimeout(() => setSaveMsg(""), 2500);
              });
            }}>
              Share
            </button>
          </div>
        </div>

        <div key={recSeed} className="dashOutfitsAnimWrap">
          {!aiHasResolved ? (
            <div className="dashAiLoading" style={{ padding: "32px 0", textAlign: "center" }}>
              Generating your outfits...
            </div>
          ) : outfits.map((outfit, idx) => {
            const sig = outfitSignature(outfit);
            const isSaved = savedSigs.has(sig);
            const disabled = !sig || savingSig === sig;
            const label = isSaved ? "Unsave" : savingSig === sig ? "Saving..." : "Save";

            return (
              <div
                key={`opt_${idx}`}
                className={"dashOutfitOption" + (idx === selectedIdx ? " dashOutfitSelected" : "")}
                style={{ animationDelay: `${idx * 120}ms`, marginTop: idx === 0 ? 0 : 18, cursor: "pointer" }}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className="optionLabel">
                  <span className="optionLabelNum">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="optionLabelSlash">//</span>
                  <span className="optionLabelText">OPTION</span>
                </div>

                <div className="dashOutfitGridFigma">
                  {outfit.map((item) => (
                    <div key={item.id} className="dashSquareTile">
                      {item.image_url ? (
                        <img className="dashSquareImg" src={item.image_url} alt={item.name} />
                      ) : (
                        <div className="dashSquareImg" aria-hidden="true" />
                      )}
                      <div className="dashSquareNameRow">
                        <span
                          className="dashColorDot"
                          style={{ background: colorToCss(item.color) }}
                          title={item.color}
                        />
                        <span className="dashSquareName">{item.name}</span>
                      </div>
                    </div>
                  ))}

                  <div className="dashSaveBtnCell">
                    <button
                      type="button"
                      className={"styledSaveBtn" + (isSaved ? " saved" : "")}
                      onClick={() => handleSaveOutfit(outfit)}
                      disabled={disabled}
                    >
                      <span className="styledSaveBtnIcon">{isSaved ? "\u2713" : "\u2661"}</span>
                      <span className="styledSaveBtnText">{label}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="dashInfoBlock" aria-live="polite" style={{ marginTop: 12 }}>
          <div className="dashInfoTitle">
            Why Option {String(selectedIdx + 1).padStart(2, "0")}?
            {aiSource === "ai" && !reused ? <span className="dashAiBadge">AI Powered Suggestion</span> : null}
          </div>
          {aiLoading ? (
            <div className="dashAiLoading">Thinking...</div>
          ) : (
            <div className="dashSubText" style={{ lineHeight: 1.45 }}>
              <span key={`${selectedIdx}-${aiRefreshToken}-${recSeed}`} className="dashAiReveal">
                {explanationText.split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    <span className="dashAiWord" style={{ animationDelay: `${i * 40}ms` }}>
                      {word}
                    </span>{" "}
                  </React.Fragment>
                ))}
              </span>
            </div>
          )}
        </div>


        {saveMsg ? (
          <div className="noteBox" style={{ marginTop: 12 }}>
            {saveMsg}
          </div>
        ) : null}
      </section>

      <section className="card dashWide">
        <div className="dashCardTitle">Quick Actions</div>

        <div className="dashQuickActionsGrid">
          <button type="button" className="dashQuickActionFigma" onClick={goAddItem}>
            <div className="dashQAIcon">+</div>
            <div className="dashQAContent">
              <div className="dashQATitle">Add item</div>
              <div className="dashQADesc">Upload a new wardrobe piece</div>
            </div>
            <span className="dashQAArrow">&rsaquo;</span>
          </button>

          <button type="button" className="dashQuickActionFigma" onClick={openPlanModal}>
            <div className="dashQAIcon">{"\u2606"}</div>
            <div className="dashQAContent">
              <div className="dashQATitle">Plan Tomorrow’s Outfit</div>
              <div className="dashQADesc">Get ahead of your schedule</div>
            </div>
            <span className="dashQAArrow">&rsaquo;</span>
          </button>

          <button type="button" className="dashQuickActionFigma" onClick={() => navigate("/history")}>
            <div className="dashQAIcon">{"\u29D6"}</div>
            <div className="dashQAContent">
              <div className="dashQATitle">Browse Past Outfits</div>
              <div className="dashQADesc">See what you’ve worn recently</div>
            </div>
            <span className="dashQAArrow">&rsaquo;</span>
          </button>
        </div>
      </section>

      {showPlanModal && ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Plan This Outfit</div>
            <div className="modalSub">Pick a date and occasion for this outfit.</div>

            <div style={{ marginTop: 16 }}>
              <label className="planModalLabel">Date</label>
              <input
                type="date"
                className="wardrobeInput"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="planModalLabel">Occasion</label>
              <input
                type="text"
                className="wardrobeInput"
                placeholder="e.g. Work, Date night, Casual..."
                value={planOccasion}
                onChange={(e) => setPlanOccasion(e.target.value)}
              />
            </div>

            <div className="modalActions" style={{ marginTop: 18 }}>
              <button className="btn" onClick={() => setShowPlanModal(false)} disabled={planSaving}>
                Cancel
              </button>
              <button className="btn primary" onClick={handlePlanSave} disabled={planSaving}>
                {planSaving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );

}