import { idsSignature } from "./helpers";
import {
  EVT_RECOMMENDATION_PERSONALIZATION_CHANGED,
  RECOMMENDATION_PERSONALIZATION_KEY,
} from "./constants";
import { makeObjectStore } from "./userStorage";

const personalizationStore = makeObjectStore(
  RECOMMENDATION_PERSONALIZATION_KEY,
  EVT_RECOMMENDATION_PERSONALIZATION_CHANGED
);

const CURRENT_VERSION = 1;

export const PERSONALIZATION_ACTIONS = {
  SELECT: "selected",
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

function outfitAttributes(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  const itemIds = uniqueStrings(items.map((item) => item?.id));
  const colors = uniqueStrings(items.flatMap((item) => splitColors(item?.color)));
  const categories = uniqueStrings(items.map((item) => normalizeCategory(item?.category)));
  const styleTags = uniqueStrings(
    items.flatMap((item) => item?.style_tags || item?.styleTags || item?.style_tag || item?.styleTag || [])
  )
    .map(normalizeTag)
    .filter(Boolean);
  const occasionTags = uniqueStrings(items.flatMap((item) => item?.occasion_tags || item?.occasionTags || []))
    .map(normalizeTag)
    .filter(Boolean);
  const fitTags = uniqueStrings(items.map((item) => normalizeFit(item?.fit_tag || item?.fitTag || item?.fit)));

  return { itemIds, colors, categories, styleTags, occasionTags, fitTags };
}

function createEmptyState() {
  return {
    version: CURRENT_VERSION,
    entriesBySignature: {},
    updatedAt: 0,
  };
}

function normalizeCounts(counts) {
  const raw = counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {};
  return {
    selected: Math.max(0, Number(raw.selected) || 0),
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const signature = (entry.signature || "").toString().trim();
  if (!signature) return null;

  return {
    signature,
    updatedAt: Number(entry.updatedAt) || Date.now(),
    itemIds: uniqueStrings(entry.itemIds),
    colors: uniqueStrings(entry.colors).map(normalizeColor).filter(Boolean),
    categories: uniqueStrings(entry.categories).map(normalizeCategory).filter(Boolean),
    styleTags: uniqueStrings(entry.styleTags).map(normalizeTag).filter(Boolean),
    occasionTags: uniqueStrings(entry.occasionTags).map(normalizeTag).filter(Boolean),
    fitTags: uniqueStrings(entry.fitTags).map(normalizeFit).filter(Boolean),
    counts: normalizeCounts(entry.counts),
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

function saveRecommendationPersonalizationState(state, user) {
  const normalized = normalizeState(state);
  personalizationStore.write(
    {
      ...normalized,
      updatedAt: Date.now(),
    },
    user
  );
  return normalizeState(personalizationStore.read(user));
}

function bump(map, key, amount) {
  if (!key || !Number.isFinite(amount) || amount <= 0) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function recencyMultiplier(timestamp) {
  const parsed = Number(new Date(timestamp).getTime());
  const ageMs = Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : 0;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return 0.72 + 0.28 * Math.exp(-ageDays / 45);
}

function strengthFromCount(count, base, cap) {
  const safeCount = Math.max(0, Number(count) || 0);
  if (!safeCount) return 0;
  return Math.min(cap, Math.log2(safeCount + 1) * base);
}

function applySignal(profile, attrs, strength, sourceKey) {
  if (!attrs || !Number.isFinite(strength) || strength <= 0) return;

  const {
    signature = "",
    itemIds = [],
    colors = [],
    categories = [],
    styleTags = [],
    occasionTags = [],
    fitTags = [],
  } = attrs;

  profile.signalCount += strength;
  profile.sourceCounts[sourceKey] = (profile.sourceCounts[sourceKey] || 0) + 1;

  bump(profile.exactSignals, signature, strength * 0.95);
  itemIds.forEach((itemId) => bump(profile.itemIds, itemId, strength * 0.55));
  colors.forEach((color) => bump(profile.colors, color, strength * 0.8));
  categories.forEach((category) => bump(profile.categories, category, strength * 0.72));
  styleTags.forEach((tag) => bump(profile.styleTags, tag, strength * 0.68));
  occasionTags.forEach((tag) => bump(profile.occasionTags, tag, strength * 0.64));
  fitTags.forEach((tag) => bump(profile.fitTags, tag, strength * 0.52));
}

function entryFromItems(items) {
  const signature = idsSignature((Array.isArray(items) ? items : []).map((item) => item?.id));
  if (!signature) return null;
  return {
    signature,
    ...outfitAttributes(items),
  };
}

function itemsFromRecord(record, wardrobeById) {
  const detailed = Array.isArray(record?.item_details) ? record.item_details.filter(Boolean) : [];
  if (detailed.length) return detailed;

  return (Array.isArray(record?.items) ? record.items : Array.isArray(record?.item_ids) ? record.item_ids : [])
    .map((id) => wardrobeById.get((id ?? "").toString()))
    .filter(Boolean);
}

export function readRecommendationPersonalization(user) {
  return normalizeState(personalizationStore.read(user));
}

export function trackRecommendationPersonalization({
  user,
  outfit,
  action = PERSONALIZATION_ACTIONS.SELECT,
}) {
  const normalizedAction = (action || "").toString().trim().toLowerCase();
  if (normalizedAction !== PERSONALIZATION_ACTIONS.SELECT) {
    return null;
  }

  const signature = idsSignature((Array.isArray(outfit) ? outfit : []).map((item) => item?.id));
  if (!signature) return null;

  const current = readRecommendationPersonalization(user);
  const previous = current.entriesBySignature[signature] || null;
  const attributes = outfitAttributes(outfit);
  const nextEntry = normalizeEntry({
    signature,
    updatedAt: Date.now(),
    counts: {
      ...(previous?.counts || {}),
      selected: (previous?.counts?.selected || 0) + 1,
    },
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

  return {
    signature,
    entry: nextEntry,
    state: saveRecommendationPersonalizationState(nextState, user),
  };
}

export function buildRecommendationPersonalizationProfile({
  interactionState,
  savedOutfits,
  historyEntries,
  wardrobe,
} = {}) {
  const profile = {
    exactSignals: new Map(),
    itemIds: new Map(),
    colors: new Map(),
    categories: new Map(),
    styleTags: new Map(),
    occasionTags: new Map(),
    fitTags: new Map(),
    signalCount: 0,
    sourceCounts: {
      selected: 0,
      saved: 0,
      history: 0,
    },
  };

  const normalizedState = normalizeState(interactionState);
  const wardrobeById = new Map(
    (Array.isArray(wardrobe) ? wardrobe : [])
      .filter(Boolean)
      .map((item) => [((item?.id ?? "").toString()), item])
  );

  Object.values(normalizedState.entriesBySignature).forEach((entry) => {
    const strength = strengthFromCount(entry?.counts?.selected, 0.7, 1.9) * recencyMultiplier(entry.updatedAt);
    applySignal(profile, entry, strength, "selected");
  });

  (Array.isArray(savedOutfits) ? savedOutfits : []).forEach((record) => {
    const items = itemsFromRecord(record, wardrobeById);
    const attrs = entryFromItems(items);
    if (!attrs) return;
    const strength = 0.95 * recencyMultiplier(record?.created_at || record?.updated_at);
    applySignal(profile, attrs, strength, "saved");
  });

  (Array.isArray(historyEntries) ? historyEntries : []).forEach((record) => {
    const items = itemsFromRecord(record, wardrobeById);
    const attrs = entryFromItems(items);
    if (!attrs) return;
    const strength = 1.1 * recencyMultiplier(record?.worn_at || record?.created_at);
    applySignal(profile, attrs, strength, "history");
  });

  return {
    ...profile,
    hasSignals: profile.signalCount >= 1.25,
    isEstablished: profile.signalCount >= 4.5,
  };
}

export function personalizationBiasForOutfit(outfit, profile) {
  if (!profile || typeof profile !== "object") return 0;

  const attrs = entryFromItems(outfit);
  if (!attrs) return 0;

  let score = 0;

  score += clamp((profile.exactSignals?.get(attrs.signature) || 0) * 2.2, 0, 3.6);
  attrs.itemIds.forEach((itemId) => {
    score += clamp((profile.itemIds?.get(itemId) || 0) * 0.78, 0, 1.2);
  });
  attrs.colors.forEach((color) => {
    score += clamp((profile.colors?.get(color) || 0) * 0.72, 0, 1.2);
  });
  attrs.categories.forEach((category) => {
    score += clamp((profile.categories?.get(category) || 0) * 0.66, 0, 1);
  });
  attrs.styleTags.forEach((tag) => {
    score += clamp((profile.styleTags?.get(tag) || 0) * 0.62, 0, 0.95);
  });
  attrs.occasionTags.forEach((tag) => {
    score += clamp((profile.occasionTags?.get(tag) || 0) * 0.58, 0, 0.9);
  });
  attrs.fitTags.forEach((tag) => {
    score += clamp((profile.fitTags?.get(tag) || 0) * 0.5, 0, 0.8);
  });

  return clamp(score, 0, 8);
}

export function describeRecommendationPersonalization(profile, explicitFeedbackCount = 0) {
  const passiveSignals = Number(profile?.signalCount) || 0;
  const totalSignals = passiveSignals + Math.max(0, Number(explicitFeedbackCount) || 0) * 1.6;
  const established = totalSignals >= 6.5 || profile?.isEstablished;
  const learning = !established && totalSignals >= 2;

  if (established) {
    return {
      label: "Recommended for you",
      subline: "Based on your preferences, outfit picks, and what you wear.",
      loadingLabel: "Refreshing recommendations based on your recent activity...",
      tone: "established",
    };
  }

  if (learning) {
    return {
      label: "Based on your preferences",
      subline: "Learning from your feedback and outfit selections over time.",
      loadingLabel: "Refining recommendations based on your preferences...",
      tone: "learning",
    };
  }

  return {
    label: "Based on your preferences",
    subline: "Using your onboarding choices and wardrobe basics until FitGPT learns more.",
    loadingLabel: "Generating your outfits based on your preferences...",
    tone: "new",
  };
}
