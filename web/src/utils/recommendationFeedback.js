import { idsSignature } from "./helpers";
import {
  EVT_RECOMMENDATION_FEEDBACK_CHANGED,
  RECOMMENDATION_FEEDBACK_KEY,
} from "./constants";
import { makeObjectStore } from "./userStorage";

const feedbackStore = makeObjectStore(
  RECOMMENDATION_FEEDBACK_KEY,
  EVT_RECOMMENDATION_FEEDBACK_CHANGED
);

const CURRENT_VERSION = 1;

export const FEEDBACK_SIGNALS = {
  LIKE: "like",
  DISLIKE: "dislike",
  SKIP: "skip",
};

export const FEEDBACK_REASON_OPTIONS = {
  like: [
    { code: "color", label: "Love the color" },
    { code: "fit", label: "Great silhouette" },
    { code: "style", label: "Feels like me" },
    { code: "occasion", label: "Right for today" },
  ],
  dislike: [
    { code: "color", label: "Don't like color" },
    { code: "style", label: "Style feels off" },
    { code: "fit", label: "Fit feels off" },
    { code: "occasion", label: "Wrong vibe" },
    { code: "weather", label: "Not for weather" },
  ],
};

function uniqueStrings(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => (value || "").toString().trim())
      .filter(Boolean)
  )];
}

function normalizeCategory(value) {
  const text = (value || "").toString().trim().toLowerCase();
  if (text === "top" || text === "tops") return "tops";
  if (text === "bottom" || text === "bottoms") return "bottoms";
  if (text === "shoe" || text === "shoes") return "shoes";
  if (text === "outerwear" || text === "coat" || text === "jacket") return "outerwear";
  if (text === "accessory" || text === "accessories") return "accessories";
  return text;
}

function normalizeColor(value) {
  const text = (value || "").toString().trim().toLowerCase();
  if (!text) return "";

  const aliases = {
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
    burgundy: "red",
    maroon: "red",
    wine: "red",
    charcoal: "gray",
    silver: "gray",
    denim: "navy",
  };

  return aliases[text] || text;
}

function splitColors(raw) {
  return (raw || "")
    .toString()
    .split(",")
    .map((part) => normalizeColor(part))
    .filter(Boolean);
}

function normalizeTag(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase();
}

function normalizeFit(value) {
  const text = normalizeTag(value);
  if (!text || text === "unknown") return "unspecified";
  if (text === "slim" || text === "tailored" || text === "athletic") return "fitted";
  return text;
}

function createEmptyState() {
  return {
    version: CURRENT_VERSION,
    entriesBySignature: {},
    updatedAt: 0,
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const signal = Object.values(FEEDBACK_SIGNALS).includes(entry.signal)
    ? entry.signal
    : "";
  const signature = (entry.signature || "").toString().trim();
  if (!signature || !signal) return null;

  return {
    signature,
    signal,
    detailCode: (entry.detailCode || "").toString().trim().toLowerCase(),
    note: (entry.note || "").toString().trim(),
    source: (entry.source || "dashboard").toString().trim() || "dashboard",
    updatedAt: Number(entry.updatedAt) || Date.now(),
    itemIds: uniqueStrings(entry.itemIds),
    colors: uniqueStrings(entry.colors).map(normalizeColor).filter(Boolean),
    categories: uniqueStrings(entry.categories).map(normalizeCategory).filter(Boolean),
    styleTags: uniqueStrings(entry.styleTags).map(normalizeTag).filter(Boolean),
    occasionTags: uniqueStrings(entry.occasionTags).map(normalizeTag).filter(Boolean),
    fitTags: uniqueStrings(entry.fitTags).map(normalizeFit).filter(Boolean),
  };
}

function normalizeState(raw) {
  const base = createEmptyState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;

  const entriesBySignature = {};
  const sourceEntries = raw.entriesBySignature && typeof raw.entriesBySignature === "object"
    ? raw.entriesBySignature
    : {};

  Object.values(sourceEntries).forEach((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized) return;
    entriesBySignature[normalized.signature] = normalized;
  });

  return {
    version: CURRENT_VERSION,
    entriesBySignature,
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function outfitAttributes(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  const itemIds = uniqueStrings(items.map((item) => item?.id));
  const colors = uniqueStrings(items.flatMap((item) => splitColors(item?.color)));
  const categories = uniqueStrings(items.map((item) => normalizeCategory(item?.category)));
  const styleTags = uniqueStrings(items.flatMap((item) => item?.style_tags || item?.styleTags || item?.style_tag || item?.styleTag || []))
    .map(normalizeTag)
    .filter(Boolean);
  const occasionTags = uniqueStrings(items.flatMap((item) => item?.occasion_tags || item?.occasionTags || []))
    .map(normalizeTag)
    .filter(Boolean);
  const fitTags = uniqueStrings(items.map((item) => normalizeFit(item?.fit_tag || item?.fitTag || item?.fit)));

  return { itemIds, colors, categories, styleTags, occasionTags, fitTags };
}

export function recommendationFeedbackSignature(outfit) {
  return idsSignature((Array.isArray(outfit) ? outfit : []).map((item) => item?.id));
}

export function readRecommendationFeedback(user) {
  return normalizeState(feedbackStore.read(user));
}

export function getRecommendationFeedback(state, signature) {
  const normalizedState = normalizeState(state);
  const sig = (signature || "").toString().trim();
  if (!sig) return null;
  return normalizedState.entriesBySignature[sig] || null;
}

export function saveRecommendationFeedbackState(state, user) {
  const normalized = normalizeState(state);
  feedbackStore.write(
    {
      ...normalized,
      updatedAt: Date.now(),
    },
    user
  );
  return normalizeState(feedbackStore.read(user));
}

export function upsertRecommendationFeedback({
  user,
  outfit,
  signal,
  detailCode = "",
  note = "",
  source = "dashboard",
}) {
  const normalizedSignal = (signal || "").toString().trim().toLowerCase();
  if (!Object.values(FEEDBACK_SIGNALS).includes(normalizedSignal)) {
    return null;
  }

  const signature = recommendationFeedbackSignature(outfit);
  if (!signature) return null;

  const current = readRecommendationFeedback(user);
  const previousEntry = current.entriesBySignature[signature] || null;
  const attributes = outfitAttributes(outfit);
  const nextEntry = normalizeEntry({
    signature,
    signal: normalizedSignal,
    detailCode,
    note,
    source,
    updatedAt: Date.now(),
    ...attributes,
  });

  const nextState = {
    ...current,
    entriesBySignature: {
      ...current.entriesBySignature,
      [signature]: nextEntry,
    },
    updatedAt: Date.now(),
  };

  const savedState = saveRecommendationFeedbackState(nextState, user);

  return {
    signature,
    entry: nextEntry,
    previousEntry,
    state: savedState,
  };
}

export function restoreRecommendationFeedback({
  user,
  signature,
  previousEntry,
}) {
  const sig = (signature || "").toString().trim();
  if (!sig) return readRecommendationFeedback(user);

  const current = readRecommendationFeedback(user);
  const nextEntries = { ...current.entriesBySignature };

  if (previousEntry) nextEntries[sig] = normalizeEntry(previousEntry);
  else delete nextEntries[sig];

  return saveRecommendationFeedbackState(
    {
      ...current,
      entriesBySignature: nextEntries,
      updatedAt: Date.now(),
    },
    user
  );
}

function bump(map, key, amount) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function detailWeights(detailCode) {
  switch ((detailCode || "").toString().trim().toLowerCase()) {
    case "color":
      return { exact: 0.75, color: 1.45, category: 0.7, style: 0.7, occasion: 0.7, fit: 0.7 };
    case "style":
      return { exact: 0.8, color: 0.8, category: 0.85, style: 1.45, occasion: 1.05, fit: 0.8 };
    case "fit":
      return { exact: 0.8, color: 0.7, category: 0.8, style: 0.8, occasion: 0.8, fit: 1.45 };
    case "occasion":
    case "weather":
      return { exact: 0.8, color: 0.7, category: 0.95, style: 1.05, occasion: 1.35, fit: 0.8 };
    default:
      return { exact: 1, color: 1, category: 1, style: 1, occasion: 1, fit: 1 };
  }
}

export function buildRecommendationFeedbackProfile(state) {
  const normalizedState = normalizeState(state);
  const profile = {
    exactSignals: new Map(),
    skippedSignatures: new Set(),
    colors: new Map(),
    categories: new Map(),
    styleTags: new Map(),
    occasionTags: new Map(),
    fitTags: new Map(),
  };

  Object.values(normalizedState.entriesBySignature).forEach((entry) => {
    if (entry.signal === FEEDBACK_SIGNALS.SKIP) {
      profile.skippedSignatures.add(entry.signature);
      return;
    }

    const direction = entry.signal === FEEDBACK_SIGNALS.LIKE ? 1 : -1;
    const weights = detailWeights(entry.detailCode);

    bump(profile.exactSignals, entry.signature, direction * weights.exact);
    entry.colors.forEach((color) => bump(profile.colors, color, direction * weights.color));
    entry.categories.forEach((category) => bump(profile.categories, category, direction * 0.8 * weights.category));
    entry.styleTags.forEach((tag) => bump(profile.styleTags, tag, direction * 0.7 * weights.style));
    entry.occasionTags.forEach((tag) => bump(profile.occasionTags, tag, direction * 0.6 * weights.occasion));
    entry.fitTags.forEach((tag) => bump(profile.fitTags, tag, direction * 0.55 * weights.fit));
  });

  return profile;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function feedbackBiasForOutfit(outfit, profile) {
  if (!profile || typeof profile !== "object") return 0;

  const signature = recommendationFeedbackSignature(outfit);
  const attributes = outfitAttributes(outfit);
  let score = 0;

  if (signature) {
    score += clamp((profile.exactSignals?.get(signature) || 0) * 5.5, -7.5, 6);
    if (profile.skippedSignatures?.has(signature)) score -= 1.8;
  }

  attributes.colors.forEach((color) => {
    score += clamp((profile.colors?.get(color) || 0) * 1.1, -1.8, 1.8);
  });
  attributes.categories.forEach((category) => {
    score += clamp((profile.categories?.get(category) || 0) * 0.9, -1.4, 1.4);
  });
  attributes.styleTags.forEach((tag) => {
    score += clamp((profile.styleTags?.get(tag) || 0) * 0.8, -1.2, 1.2);
  });
  attributes.occasionTags.forEach((tag) => {
    score += clamp((profile.occasionTags?.get(tag) || 0) * 0.7, -1.1, 1.1);
  });
  attributes.fitTags.forEach((tag) => {
    score += clamp((profile.fitTags?.get(tag) || 0) * 0.65, -1, 1);
  });

  return clamp(score, -12, 10);
}

export function buildRecommendationFeedbackPayload({
  entry,
  context = {},
}) {
  if (!entry) return null;

  return {
    suggestion_id: entry.signature,
    signal: entry.signal,
    detail_code: entry.detailCode || "",
    note: entry.note || "",
    source: entry.source || "dashboard",
    updated_at: entry.updatedAt,
    item_ids: (() => { const ids = (entry.itemIds || []).map((id) => Number(id)).filter((n) => Number.isInteger(n) && n > 0); return ids.length ? ids : null; })(),
    colors: entry.colors || [],
    categories: entry.categories || [],
    style_tags: entry.styleTags || [],
    occasion_tags: entry.occasionTags || [],
    fit_tags: entry.fitTags || [],
    context,
  };
}
