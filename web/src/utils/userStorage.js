

import { GUEST_WARDROBE_KEY, WARDROBE_KEY, SAVED_OUTFITS_KEY, OUTFIT_HISTORY_KEY, PLANNED_OUTFITS_KEY, TRIP_PACKING_KEY, PROFILE_KEY, ONBOARDING_ANSWERS_KEY, ONBOARDED_KEY, SPLASH_SEEN_KEY, ONBOARDING_COMPLETE_KEY, TUTORIAL_COMPLETE_KEY, GUEST_MODE_KEY, EVT_WARDROBE_CHANGED, REC_SEED_KEY, TIME_OVERRIDE_KEY, WEATHER_OVERRIDE_KEY, SEASONAL_PREFERENCES_KEY, DEMO_AUTH_KEY, PROFILE_PIC_KEY, EVT_PROFILE_PIC_CHANGED, TUTORIAL_DONE_KEY } from "./constants";
import { safeParse } from "./helpers";
import { normalizeItemMetadata, mergeWardrobeMetadata } from "./wardrobeOptions";

const KEY_STORAGE_MAP = [
  { key: GUEST_WARDROBE_KEY, storage: "session" },
  { key: WARDROBE_KEY, storage: "local" },
  { key: SAVED_OUTFITS_KEY, storage: "local" },
  { key: OUTFIT_HISTORY_KEY, storage: "local" },
  { key: PLANNED_OUTFITS_KEY, storage: "local" },
  { key: TRIP_PACKING_KEY, storage: "local" },
  { key: PROFILE_KEY, storage: "local" },
  { key: ONBOARDING_ANSWERS_KEY, storage: "local" },
  { key: ONBOARDED_KEY, storage: "local" },
];


export function getUserId(user) {
  if (!user) return null;
  const id = user.id ?? user.user_id ?? user.email ?? user.demoEmail ?? null;
  const s = (id ?? "").toString().trim();
  return s || null;
}

export function userKey(baseKey, user) {
  const id = getUserId(user);
  if (!id) return baseKey;
  return `${baseKey}_${id}`;
}

function readArray(store, key) {
  const raw = store.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

export function loadWardrobe(user) {
  const id = getUserId(user);
  const guestKey = userKey(GUEST_WARDROBE_KEY, user);
  const lsKey = userKey(WARDROBE_KEY, user);

  const guest = readArray(sessionStorage, guestKey).map(normalizeItemMetadata);
  if (guest.length > 0) return guest;

  if (!id) return [];

  const ls = readArray(localStorage, lsKey).map(normalizeItemMetadata);
  if (ls.length > 0) return ls;

  const baseGuest = readArray(sessionStorage, GUEST_WARDROBE_KEY).map(normalizeItemMetadata);
  if (baseGuest.length > 0) return baseGuest;

  const baseLs = readArray(localStorage, WARDROBE_KEY).map(normalizeItemMetadata);
  if (baseLs.length > 0) return baseLs;

  return [];
}


export function saveWardrobe(items, user) {
  const sessionKey = userKey(GUEST_WARDROBE_KEY, user);
  const localKey = userKey(WARDROBE_KEY, user);
  const safe = (Array.isArray(items) ? items : []).map((item) => {
    const normalized = normalizeItemMetadata(item);
    const imageUrl = (normalized.image_url || "").toString().trim();
    if (/^https?:\/\//i.test(imageUrl)) {
      const {
        base64_image_url,
        local_preview_image_url,
        preview_image_url,
        ...withoutTransientPreviews
      } = normalized;
      return withoutTransientPreviews;
    }
    return normalized;
  });
  const json = JSON.stringify(safe);
  try {
    sessionStorage.setItem(sessionKey, json);
    if (getUserId(user)) {
      localStorage.setItem(localKey, json);
    } else {
      localStorage.removeItem(WARDROBE_KEY);
    }
    window.dispatchEvent(new Event(EVT_WARDROBE_CHANGED));
  } catch (e) {
    console.warn("Storage quota exceeded, skipping save:", e);
  }
}


export function migrateGuestData(user) {
  const id = getUserId(user);
  if (!id) return;

  for (const { key: baseKey, storage } of KEY_STORAGE_MAP) {
    const namespacedKey = `${baseKey}_${id}`;
    const store = storage === "session" ? sessionStorage : localStorage;

    const baseRaw = store.getItem(baseKey);
    if (!baseRaw) continue;

   
    const existingRaw = store.getItem(namespacedKey);
    if (existingRaw) {
      const existingParsed = safeParse(existingRaw);
      const hasData = Array.isArray(existingParsed) ? existingParsed.length > 0 : !!existingParsed;
      if (hasData) continue;
    }

    store.setItem(namespacedKey, baseRaw);
  }
}


export function mergeWardrobeWithLocalMetadata(remoteItems, localItems) {
  const localById = new Map(
    (Array.isArray(localItems) ? localItems : [])
      .map(normalizeItemMetadata)
      .map((item) => [String(item?.id || ""), item])
  );
  const remoteWithoutImages = (Array.isArray(remoteItems) ? remoteItems : []).map((item) => ({
    ...item,
    image_url: "",
  }));

  return mergeWardrobeMetadata(remoteWithoutImages, localItems).map((item) => {
    const id = String(item?.id || "");
    if (!id || !localById.has(id)) return item;

    return {
      ...item,
      image_url: (localById.get(id)?.image_url || "").toString().trim(),
    };
  });
}

export function clearGuestData() {
  for (const { key: baseKey, storage } of KEY_STORAGE_MAP) {
    const store = storage === "session" ? sessionStorage : localStorage;
    store.removeItem(baseKey);
  }
  localStorage.removeItem(GUEST_MODE_KEY);
}

export function mirrorUserDataToGuest(user) {
  const id = getUserId(user);
  if (!id) return;

  const keysToMirror = [
    { key: GUEST_WARDROBE_KEY, storage: "session" },
    { key: WARDROBE_KEY, storage: "local" },
    { key: PROFILE_KEY, storage: "local" },
    { key: ONBOARDING_ANSWERS_KEY, storage: "local" },
    { key: ONBOARDED_KEY, storage: "local" },
    { key: PROFILE_PIC_KEY, storage: "local" },
  ];

  for (const { key: baseKey, storage } of keysToMirror) {
    const store = storage === "session" ? sessionStorage : localStorage;
    const namespacedKey = `${baseKey}_${id}`;
    const raw = store.getItem(namespacedKey);

    if (raw == null) continue;
    store.setItem(baseKey, raw);
  }

  window.dispatchEvent(new Event(EVT_WARDROBE_CHANGED));
  window.dispatchEvent(new Event(EVT_PROFILE_PIC_CHANGED));
}


export function makeLocalStore(storageKey, eventName) {
  return {
    read(user) {
      const key = userKey(storageKey, user);
      const raw = localStorage.getItem(key);
      const parsed = raw ? safeParse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    },
    write(list, user) {
      const key = userKey(storageKey, user);
      localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
      if (eventName) window.dispatchEvent(new Event(eventName));
    },
  };
}


export function makeObjectStore(storageKey, eventName) {
  return {
    read(user) {
      const key = userKey(storageKey, user);
      const raw = localStorage.getItem(key);
      const parsed = raw ? safeParse(raw) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    },
    write(obj, user) {
      const key = userKey(storageKey, user);
      localStorage.setItem(key, JSON.stringify(obj && typeof obj === "object" ? obj : {}));
      if (eventName) window.dispatchEvent(new Event(eventName));
    },
  };
}



const ALLOWED_WEATHER = new Set(["cold", "cool", "mild", "warm", "hot"]);
const ALLOWED_TIMES = new Set(["morning", "work hours", "evening", "night"]);

export function readSeasonalPreferences(user) {
  const raw = localStorage.getItem(userKey(SEASONAL_PREFERENCES_KEY, user));
  const parsed = raw ? safeParse(raw) : null;
  const enabled = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed.enabled !== false
    : true;

  return { enabled };
}

export function writeSeasonalPreferences(next, user) {
  const current = readSeasonalPreferences(user);
  const merged = next && typeof next === "object" && !Array.isArray(next)
    ? { ...current, ...next }
    : current;

  localStorage.setItem(
    userKey(SEASONAL_PREFERENCES_KEY, user),
    JSON.stringify({ enabled: merged.enabled !== false })
  );
}

export function readSeasonalMode(user) {
  return readSeasonalPreferences(user).enabled;
}

export function writeSeasonalMode(enabled, user) {
  writeSeasonalPreferences({ enabled: !!enabled }, user);
}

export function readWeatherOverride() {
  const raw = sessionStorage.getItem(WEATHER_OVERRIDE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const v = (parsed?.category || "").toString().trim().toLowerCase();
  return ALLOWED_WEATHER.has(v) ? v : null;
}

export function setWeatherOverride(categoryOrNull) {
  const v = (categoryOrNull || "").toString().trim().toLowerCase();
  if (!ALLOWED_WEATHER.has(v)) {
    sessionStorage.removeItem(WEATHER_OVERRIDE_KEY);
    return;
  }
  sessionStorage.setItem(WEATHER_OVERRIDE_KEY, JSON.stringify({ category: v }));
}

export function readRecSeed() {
  try {
    const raw = sessionStorage.getItem(REC_SEED_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {}
  return Date.now();
}

export function writeRecSeed(seed) {
  try {
    sessionStorage.setItem(REC_SEED_KEY, String(seed));
  } catch {}
}

export function readTimeOverride() {
  const raw = sessionStorage.getItem(TIME_OVERRIDE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  const v = (parsed ?? raw ?? "").toString().trim().toLowerCase();
  return ALLOWED_TIMES.has(v) ? v : "";
}

export function writeTimeOverride(nextOrEmpty) {
  const v = (nextOrEmpty || "").toString().trim().toLowerCase();
  if (!v) {
    sessionStorage.removeItem(TIME_OVERRIDE_KEY);
    return;
  }
  sessionStorage.setItem(TIME_OVERRIDE_KEY, JSON.stringify(v));
}



export function readDemoAuth() {
  const raw = localStorage.getItem(DEMO_AUTH_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function writeDemoAuth(objOrNull) {
  if (!objOrNull) localStorage.removeItem(DEMO_AUTH_KEY);
  else localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(objOrNull));
}



export function loadAnswers(user) {
  try {
    const key = userKey(ONBOARDING_ANSWERS_KEY, user);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAnswers(answers, user) {
  try {
    localStorage.setItem(userKey(ONBOARDING_ANSWERS_KEY, user), JSON.stringify(answers));
    localStorage.setItem(userKey(ONBOARDED_KEY, user), "1");
    localStorage.setItem(userKey(ONBOARDING_COMPLETE_KEY, user), "1");
  } catch {}
}

export function isOnboarded(user) {
  return (
    localStorage.getItem(userKey(ONBOARDED_KEY, user)) === "1" ||
    localStorage.getItem(userKey(ONBOARDING_COMPLETE_KEY, user)) === "1"
  );
}

export function clearOnboarding(user) {
  localStorage.removeItem(userKey(ONBOARDING_ANSWERS_KEY, user));
  localStorage.removeItem(userKey(ONBOARDED_KEY, user));
  localStorage.removeItem(userKey(ONBOARDING_COMPLETE_KEY, user));
}



export function loadProfilePic(user) {
  const key = userKey(PROFILE_PIC_KEY, user);
  return localStorage.getItem(key) || "";
}

export function saveProfilePic(pic, user) {
  const key = userKey(PROFILE_PIC_KEY, user);
  if (!pic) localStorage.removeItem(key);
  else localStorage.setItem(key, pic);
  window.dispatchEvent(new Event(EVT_PROFILE_PIC_CHANGED));
}



export function isTutorialDone() {
  return (
    localStorage.getItem(TUTORIAL_DONE_KEY) === "1" ||
    localStorage.getItem(TUTORIAL_COMPLETE_KEY) === "1"
  );
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
    localStorage.setItem(TUTORIAL_COMPLETE_KEY, "1");
  } catch {}
}

export function clearTutorialDone() {
  localStorage.removeItem(TUTORIAL_DONE_KEY);
  localStorage.removeItem(TUTORIAL_COMPLETE_KEY);
}

export function isSplashSeen() {
  return localStorage.getItem(SPLASH_SEEN_KEY) === "1";
}

export function markSplashSeen() {
  try {
    localStorage.setItem(SPLASH_SEEN_KEY, "1");
  } catch {}
}

export function clearSplashSeen() {
  localStorage.removeItem(SPLASH_SEEN_KEY);
}

export function isGuestMode(user) {
  return !user && localStorage.getItem(GUEST_MODE_KEY) === "1";
}

export function setGuestMode(enabled) {
  if (enabled) localStorage.setItem(GUEST_MODE_KEY, "1");
  else localStorage.removeItem(GUEST_MODE_KEY);
}

const REJECTED_OUTFITS_KEY = "fitgpt_rejected_outfits_v1";
const LEGACY_RECOMMENDATION_FEEDBACK_KEY = "fitgpt_recommendation_feedback_legacy_v1";
const DISMISSED_DUPLICATES_KEY = "fitgpt_dismissed_duplicates_v1";

function summarizeOutfitFeedbackEntry(outfit, feedback) {
  const items = Array.isArray(outfit) ? outfit : [];
  return {
    feedback: (feedback || "").toString().trim().toLowerCase(),
    itemIds: items.map((item) => (item?.id ?? "").toString()).filter(Boolean),
    colors: [...new Set(items.map((item) => (item?.color || "").toString().trim().toLowerCase()).filter(Boolean))],
    categories: [...new Set(items.map((item) => (item?.category || "").toString().trim().toLowerCase()).filter(Boolean))],
    fitTags: [...new Set(items.map((item) => (item?.fit_tag || item?.fitTag || item?.fit || "").toString().trim().toLowerCase()).filter(Boolean))],
    styleTags: [...new Set(items.flatMap((item) => item?.style_tags || item?.styleTags || item?.style_tag || item?.styleTag || []).map((tag) => (tag || "").toString().trim().toLowerCase()).filter(Boolean))],
    occasionTags: [...new Set(items.flatMap((item) => item?.occasion_tags || item?.occasionTags || []).map((tag) => (tag || "").toString().trim().toLowerCase()).filter(Boolean))],
    timestamp: Date.now(),
  };
}

export function loadRejectedOutfits(user) {
  const key = userKey(REJECTED_OUTFITS_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

export function saveRejectedOutfit(outfit, user) {
  const key = userKey(REJECTED_OUTFITS_KEY, user);
  const next = [...loadRejectedOutfits(user), { items: Array.isArray(outfit) ? outfit : [], timestamp: Date.now() }].slice(-40);
  localStorage.setItem(key, JSON.stringify(next));
}

export function loadRecommendationFeedback(user) {
  const key = userKey(LEGACY_RECOMMENDATION_FEEDBACK_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

export function saveRecommendationFeedback(outfit, feedback, user) {
  const key = userKey(LEGACY_RECOMMENDATION_FEEDBACK_KEY, user);
  const next = [...loadRecommendationFeedback(user), summarizeOutfitFeedbackEntry(outfit, feedback)].slice(-120);
  localStorage.setItem(key, JSON.stringify(next));
}

export function loadDismissedDuplicates(user) {
  const key = userKey(DISMISSED_DUPLICATES_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed)
    ? parsed.map((value) => (value || "").toString().trim()).filter(Boolean)
    : [];
}

export function dismissDuplicatePair(pairKey, user) {
  const key = userKey(DISMISSED_DUPLICATES_KEY, user);
  const next = [...new Set([...loadDismissedDuplicates(user), (pairKey || "").toString().trim()].filter(Boolean))];
  localStorage.setItem(key, JSON.stringify(next));
}


export {
  GUEST_WARDROBE_KEY,
  WARDROBE_KEY,
  SAVED_OUTFITS_KEY,
  OUTFIT_HISTORY_KEY,
  PLANNED_OUTFITS_KEY,
  TRIP_PACKING_KEY,
  PROFILE_KEY,
  ONBOARDING_ANSWERS_KEY,
  ONBOARDED_KEY,
};
