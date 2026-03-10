// Recommendation engine — pure functions extracted from Dashboard.js
// Handles outfit generation, scoring, color coordination, weather/time biasing,
// and explanation text generation.

import { normalizeFitTag, normalizeItems, idsSignature } from "./helpers";

const DEFAULT_BODY_TYPE = "rectangle";

/* ── Text helpers ───────────────────────────────────────────── */

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

/* ── Fit penalty ────────────────────────────────────────────── */

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

/* ── Color coordination engine ──────────────────────────────── */

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

/* ── PRNG ───────────────────────────────────────────────────── */

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

/* ── Weather ────────────────────────────────────────────────── */

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

/* ── Time of day ────────────────────────────────────────────── */

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

/* ── Scoring / matching ─────────────────────────────────────── */

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

/* ── Wardrobe bucketing ─────────────────────────────────────── */

export function bucketWardrobe(activeItems) {
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

/* ── Default outfit set (when wardrobe is empty) ────────────── */

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

/* ── Outfit generation ──────────────────────────────────────── */

export function generateThreeOutfits(items, seedNumber, bodyTypeId, recentExactSigs, recentItemCounts, weatherCat, timeCat, answers, savedSigs) {
  const active = (Array.isArray(items) ? items : []).filter(
    (x) => x && x.is_active !== false && String(x.is_active) !== "false"
  );

  if (active.length === 0) {
    return [];
  }

  const seed = typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const buckets = bucketWardrobe(active);

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

  const usedTopIds = new Set();

  const results = [];
  const skipSigs = savedSigs instanceof Set ? savedSigs : new Set();

  for (let optIdx = 0; optIdx < 6 && results.length < 3; optIdx++) {
    const outfitItems = [];

    const shuffledTops = shuffle(buckets.Tops, rng);
    const unusedTop = shuffledTops.find((t) => !usedTopIds.has(t.id));
    const top = unusedTop || shuffledTops[0] || null;
    if (top) {
      usedTopIds.add(top.id);
      outfitItems.push(top);
    }

    const bottom = bestMatch(outfitItems, shuffle(buckets.Bottoms, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
    if (bottom) outfitItems.push(bottom);

    const shoes = bestMatch(outfitItems, shuffle(buckets.Shoes, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
    if (shoes) outfitItems.push(shoes);

    if (includeOuterwear) {
      const outer = bestMatch(outfitItems, shuffle(buckets.Outerwear, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
      if (outer) outfitItems.push(outer);
    }

    if (includeOther) {
      const accessory = bestMatch(outfitItems, shuffle(buckets.Other, rng), rng, bodyTypeId, recentItemCounts, weatherCat, timeCat, answers);
      if (accessory) outfitItems.push(accessory);
    }

    // Deduplicate: keep only the first item per category (prevents 2+ shoes, etc.)
    const seenCats = new Set();
    const deduped = [];
    for (const x of outfitItems) {
      const cat = normalizeCategory(x.category);
      if (cat && seenCats.has(cat)) continue;
      if (cat) seenCats.add(cat);
      deduped.push(x);
    }

    const mapped = deduped.map((x, i) => ({
      id: x.id ?? `w${i}_${x._idx}`,
      name: x.name ?? "Wardrobe item",
      category: normalizeCategory(x.category),
      color: titleCase(x.color || ""),
      fit_tag: normalizeFitTag(x.fit_tag),
      image_url: x.image_url || "",
    }));

    if (mapped.length) {
      const sig = idsSignature(mapped.map((x) => x.id));
      if (sig && skipSigs.has(sig)) continue;
      results.push(mapped);
    }
  }

  if (!results.length) return [];
  while (results.length < 3) {
    results.push(results[results.length - 1]);
  }

  return results.slice(0, 3);
}

/* ── Signature helpers ──────────────────────────────────────── */

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

/* ── Explanation text generation ─────────────────────────────── */

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
      `This outfit nails ${styleHint} for ${occasion}${timeHint}.`,
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

  const colorSent = describeColorHarmony(colors, seed);

  const closing = isNotableWeather
    ? weatherSentence(weatherCategory, seed)
    : bodyTypeSentence(bodyTypeId, seed);

  return [opener, colorSent, closing].filter(Boolean).join(" ").trim();
}

/* ── Outfit reuse helpers ───────────────────────────────────── */

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
