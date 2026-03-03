// web/src/components/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../api/authApi";
import { useAuth } from "../auth/AuthProvider";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { outfitHistoryApi } from "../api/outfitHistoryApi";

const THEME_KEY = "fitgpt_theme_v1";
const WARDROBE_KEY = "fitgpt_wardrobe_v1";
const GUEST_WARDROBE_KEY = "fitgpt_guest_wardrobe_v1";

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

function readTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return "light";

  const parsed = safeParse(raw);
  if (parsed === "light" || parsed === "dark") return parsed;
  if (raw === "light" || raw === "dark") return raw;

  return "light";
}

function readWardrobeFromStorage(storageObj, key) {
  const raw = storageObj.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function loadWardrobeForUser(isSignedIn) {
  if (isSignedIn) return readWardrobeFromStorage(localStorage, WARDROBE_KEY);
  return readWardrobeFromStorage(sessionStorage, GUEST_WARDROBE_KEY);
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

function buildOneOutfit({ buckets, rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers }) {
  const fallback = [
    ...buckets.Tops,
    ...buckets.Bottoms,
    ...buckets.Shoes,
    ...buckets.Outerwear,
    ...buckets.Other,
  ];

  const topPool = buckets.Tops.length ? buckets.Tops : fallback;
  const top = pickBestByScore(
    topPool,
    (c) => {
      const id = (c?.id ?? "").toString().trim();
      const freq = id && recentItemCounts ? recentItemCounts.get(id) || 0 : 0;
      const wBias = weatherScoreBias(weatherCat, c?.category);
      const tBias = timeScoreBias(timeCat, c?.category, answers);
      return 100 - fitPenalty(c?.fit_tag, bodyTypeId, c?.category) - freq * 2 + wBias + tBias;
    },
    rng
  );

  const bottomPool = buckets.Bottoms.length ? buckets.Bottoms : fallback;
  const bottom = bestMatch(top, bottomPool, rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);

  const shoesPool = buckets.Shoes.length ? buckets.Shoes : fallback;
  const shoes = bestMatch(bottom || top, shoesPool, rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);

  const items = [top, bottom, shoes].filter(Boolean);

  const shouldTryOuterwear = (weatherCat === "cold" || weatherCat === "cool") && buckets.Outerwear.length > 0;
  if (shouldTryOuterwear) {
    const outer = pickBestByScore(
      buckets.Outerwear,
      (c) => {
        const id = (c?.id ?? "").toString().trim();
        const freq = id && recentItemCounts ? recentItemCounts.get(id) || 0 : 0;
        const wBias = weatherScoreBias(weatherCat, c?.category);
        const tBias = timeScoreBias(timeCat, c?.category, answers);
        return 50 - freq * 2 + wBias + tBias;
      },
      rng
    );
    if (outer) items.unshift(outer);
  }

  return items.map((x, i) => ({
    id: x.id ?? `w${i}_${x._idx}`,
    name: x.name ?? "Wardrobe item",
    category: normalizeCategory(x.category),
    color: titleCase(x.color || ""),
    fit_tag: normalizeFitTag(x.fit_tag),
  }));
}

function generateThreeOutfits(items, seedNumber, bodyTypeId, recentExactSigs, recentItemCounts, weatherCat, timeCat, answers) {
  const active = (Array.isArray(items) ? items : []).filter((x) => x && x.is_active !== false);

  if (active.length === 0) {
    return defaultOutfitSet(seedNumber);
  }

  const seed = typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const buckets = bucketWardrobe(active);

  const outfits = [];
  const attemptsLimit = 18;

  for (let attempt = 0; attempt < attemptsLimit && outfits.length < 3; attempt++) {
    const rng = mulberry32(seed + attempt * 9973);

    const outfit = buildOneOutfit({
      buckets,
      rng,
      bodyTypeId: bodyTypeId || DEFAULT_BODY_TYPE,
      recentItemCounts: recentItemCounts || null,
      weatherCat: weatherCat || "mild",
      timeCat: timeCat || "work hours",
      answers: answers || null,
    });

    if (!outfit.length) continue;

    const sig = signatureFromItems(outfit);
    if (sig && recentExactSigs && recentExactSigs.has(sig)) continue;
    if (sig && outfits.some((o) => signatureFromItems(o) === sig)) continue;

    outfits.push(outfit);
  }

  while (outfits.length < 3) {
    outfits.push(defaultOutfitSet(seedNumber)[outfits.length]);
  }

  return outfits.slice(0, 3);
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

  const [theme, setTheme] = useState(() => readTheme());
  const [wardrobe, setWardrobe] = useState(() => loadWardrobeForUser(!!user));
  const [recSeed, setRecSeed] = useState(() => Date.now());

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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    setWardrobe(loadWardrobeForUser(!!user));
  }, [user]);

  useEffect(() => {
    const refresh = () => setWardrobe(loadWardrobeForUser(!!user));

    const onStorage = (e) => {
      if (!user) return;
      if (e.key === WARDROBE_KEY) refresh();
    };

    const onFocus = () => refresh();

    const onGuestWardrobeChanged = () => {
      if (!user) refresh();
    };

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

    async function loadSavedSigs() {
      if (!user) {
        if (alive) setSavedSigs(new Set());
        return;
      }

      try {
        const res = await savedOutfitsApi.listSaved();
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
        const res = await outfitHistoryApi.listHistory();
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
    if (!reused) return generatedOutfits;

    const reusedOutfit = buildOutfitFromIds(reused.items, wardrobe);
    const rest = generatedOutfits.slice(0, 2);

    return [reusedOutfit, ...rest].slice(0, 3);
  }, [generatedOutfits, reused, wardrobe]);

  const explanationText = useMemo(() => {
    const firstOutfit = outfits[0] || [];
    const text = buildExplanation1to2Sentences({ answers, outfit: firstOutfit });
    const cleaned = (text || "").toString().trim();
    return cleaned || "Pick a style and an occasion in onboarding to get a personalized explanation.";
  }, [answers, outfits]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [answers]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));
  const canRefresh = true;

  const handleRefreshRecommendation = () => {
    clearReuseOutfit();
    setRecSeed(Date.now());
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
      });

      const res = await outfitHistoryApi.listHistory();
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
    if (!user) {
      setSaveMsg("Sign in to save outfits.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      navigate("/auth");
      return;
    }

    const itemIds = (outfit || []).map((x) => x?.id).filter(Boolean);
    const normalized = savedOutfitsApi.normalizeItems(itemIds);
    const sig = normalized.join("|");

    if (!sig) {
      setSaveMsg("Nothing to save yet.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    if (savedSigs.has(sig)) {
      setSaveMsg("This outfit is already in your saved outfits.");
      window.setTimeout(() => setSaveMsg(""), 2500);
      return;
    }

    setSavingSig(sig);

    try {
      const res = await savedOutfitsApi.saveOutfit({
        items: normalized,
        source: "recommended",
        context: {
          occasion: chipText,
          temperature_category: weatherCategory,
          temperature_f: weatherTempF,
          time_of_day: timeCategory,
        },
      });

      const created = res?.created === true;
      const msg = (res?.message || "").toString().trim();

      setSavedSigs((prev) => {
        const next = new Set(prev);
        next.add(sig);
        return next;
      });

      await recordOutfitInHistory(outfit, "saved");

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
          <button type="button" className="linkBtn" onClick={toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </button>

          <button type="button" className="linkBtn" onClick={onResetOnboarding}>
            Reset
          </button>

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

      <section className="card dashWide">
        <div className="dashWeatherRow">
          <div className="dashWeatherLeft">
            <div className="dashMuted">Today's Weather</div>
            <div className="dashStrong">{weatherLine}</div>
            <div className="dashSubText" style={{ marginTop: 2 }}>
              Time: {timeLine}
            </div>

            {weatherLoading ? (
              <div className="dashSubText" style={{ marginTop: 4 }}>
                Detecting weather...
              </div>
            ) : null}

            {weatherMsg ? (
              <div className="dashSubText" style={{ marginTop: 4 }}>
                {weatherMsg}
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
            <button
              type="button"
              className="linkBtn"
              onClick={() => setShowWeatherPicker((p) => !p)}
              aria-expanded={showWeatherPicker ? "true" : "false"}
            >
              Weather
            </button>

            {showWeatherPicker ? (
              <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
                <select
                  className="wardrobeSearch"
                  value={readWeatherOverride() || ""}
                  onChange={(e) => applyWeatherOverride(e.target.value)}
                  aria-label="Weather category"
                >
                  <option value="">Use live weather</option>
                  <option value="cold">Cold</option>
                  <option value="cool">Cool</option>
                  <option value="mild">Mild</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>

                <button type="button" className="btn" onClick={() => setShowWeatherPicker(false)}>
                  Done
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="linkBtn"
              onClick={() => setShowTimePicker((p) => !p)}
              aria-expanded={showTimePicker ? "true" : "false"}
            >
              Time
            </button>

            {showTimePicker ? (
              <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
                <select
                  className="wardrobeSearch"
                  value={readTimeOverride() || ""}
                  onChange={(e) => applyTimeOverride(e.target.value)}
                  aria-label="Time of day"
                >
                  <option value="">Use system time</option>
                  <option value="morning">Morning</option>
                  <option value="work hours">Work hours</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>

                <button type="button" className="btn" onClick={() => setShowTimePicker(false)}>
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

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
        </div>

        {outfits.map((outfit, idx) => {
          const sig = outfitSignature(outfit);
          const disabled = !sig || savingSig === sig || savedSigs.has(sig);
          const label = savedSigs.has(sig) ? "Saved" : savingSig === sig ? "Saving..." : "Save";

          return (
            <div key={`opt_${idx}`} style={{ marginTop: idx === 0 ? 0 : 14 }}>
              <div className="dashMuted" style={{ fontSize: 13, marginBottom: 8 }}>
                Option {idx + 1}
              </div>

              <div className="dashOutfitGridFigma">
                {outfit.map((item) => (
                  <div key={item.id} className="dashSquareTile">
                    <div className="dashSquareImg" aria-hidden="true" />
                    <div className="dashSquareName">{item.name}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => handleSaveOutfit(outfit)} disabled={disabled}>
                  {label}
                </button>
              </div>
            </div>
          );
        })}

        <div className="dashInfoBlock" aria-live="polite" style={{ marginTop: 12 }}>
          <div className="dashInfoTitle">Why This Outfit?</div>
          <div className="dashSubText" style={{ lineHeight: 1.45 }}>
            {explanationText}
          </div>
        </div>

        <div className="dashActionRow">
          <button type="button" className="btn primary" onClick={handleRefreshRecommendation} disabled={!canRefresh}>
            Refresh suggestions
          </button>

          <button type="button" className="btn" disabled>
            Share
          </button>
        </div>

        {saveMsg ? (
          <div className="noteBox" style={{ marginTop: 12 }}>
            {saveMsg}
          </div>
        ) : null}
      </section>

      <section className="card dashWide">
        <div className="dashCardTitle">Quick Actions</div>

        <button type="button" className="dashQuickActionFigma" onClick={goAddItem}>
          <div className="dashStrong">Add item</div>
          <div className="dashSubText">Upload a new wardrobe piece</div>
        </button>

        <div className="dashQuickActionFigma" aria-disabled="true">
          <div className="dashStrong">Plan Tomorrow’s Outfit</div>
          <div className="dashSubText">Get ahead of your schedule</div>
        </div>

        <div className="dashQuickActionFigma" aria-disabled="true">
          <div className="dashStrong">Browse Past Outfits</div>
          <div className="dashSubText">See what you’ve worn recently</div>
        </div>
      </section>

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink to="/dashboard" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Today
        </NavLink>

        <NavLink to="/wardrobe" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Wardrobe
        </NavLink>

        <NavLink to="/favorites" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Favorites
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Profile
        </NavLink>
      </nav>
    </div>
  );
  
}