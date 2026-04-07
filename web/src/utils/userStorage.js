

import { GUEST_WARDROBE_KEY, WARDROBE_KEY, SAVED_OUTFITS_KEY, OUTFIT_HISTORY_KEY, PLANNED_OUTFITS_KEY, PROFILE_KEY, ONBOARDING_ANSWERS_KEY, ONBOARDED_KEY, EVT_WARDROBE_CHANGED, REC_SEED_KEY, TIME_OVERRIDE_KEY, WEATHER_OVERRIDE_KEY, DEMO_AUTH_KEY, PROFILE_PIC_KEY, EVT_PROFILE_PIC_CHANGED, TUTORIAL_DONE_KEY, REJECTED_OUTFITS_KEY, DISMISSED_DUPLICATES_KEY, RECOMMENDATION_FEEDBACK_KEY } from "./constants";
import { safeParse } from "./helpers";
import { normalizeItemMetadata, mergeWardrobeMetadata } from "./wardrobeOptions";

const KEY_STORAGE_MAP = [
  { key: GUEST_WARDROBE_KEY, storage: "session" },
  { key: WARDROBE_KEY, storage: "local" },
  { key: SAVED_OUTFITS_KEY, storage: "local" },
  { key: OUTFIT_HISTORY_KEY, storage: "local" },
  { key: PLANNED_OUTFITS_KEY, storage: "local" },
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
  const safe = (Array.isArray(items) ? items : []).map(normalizeItemMetadata);
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
  return mergeWardrobeMetadata(remoteItems, localItems);
}

export function clearGuestData() {
  for (const { key: baseKey, storage } of KEY_STORAGE_MAP) {
    const store = storage === "session" ? sessionStorage : localStorage;
    store.removeItem(baseKey);
  }
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
  } catch {}
}

export function isOnboarded(user) {
  return localStorage.getItem(userKey(ONBOARDED_KEY, user)) === "1";
}

export function clearOnboarding(user) {
  localStorage.removeItem(userKey(ONBOARDING_ANSWERS_KEY, user));
  localStorage.removeItem(userKey(ONBOARDED_KEY, user));
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
  return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {}
}


const MAX_REJECTED_OUTFITS = 50;

export function loadRejectedOutfits(user) {
  const key = userKey(REJECTED_OUTFITS_KEY, user);
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveRejectedOutfit(outfit, user) {
  const items = (Array.isArray(outfit) ? outfit : []).map((x) => ({
    id: (x?.id ?? "").toString(),
    name: x?.name || "",
    category: x?.category || "",
    color: x?.color || "",
  }));
  if (!items.length) return;
  const entry = { items, timestamp: Date.now() };
  const existing = loadRejectedOutfits(user);
  const updated = [entry, ...existing].slice(0, MAX_REJECTED_OUTFITS);
  const key = userKey(REJECTED_OUTFITS_KEY, user);
  try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
}

export function clearRejectedOutfits(user) {
  const key = userKey(REJECTED_OUTFITS_KEY, user);
  try { localStorage.removeItem(key); } catch {}
}

export function loadDismissedDuplicates(user) {
  const key = userKey(DISMISSED_DUPLICATES_KEY, user);
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

const MAX_FEEDBACK_ENTRIES = 100;

export function loadRecommendationFeedback(user) {
  const key = userKey(RECOMMENDATION_FEEDBACK_KEY, user);
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveRecommendationFeedback(outfit, feedback, user) {
  if (feedback !== "like" && feedback !== "dislike") return;
  const items = Array.isArray(outfit) ? outfit : [];
  if (!items.length) return;
  const entry = {
    itemIds: items.map((x) => (x?.id ?? "").toString()).filter(Boolean),
    feedback,
    timestamp: Date.now(),
    colors: [...new Set(items.map((x) => (x?.color || "").toLowerCase()).filter(Boolean))],
    clothingTypes: [...new Set(items.map((x) => (x?.clothing_type || x?.type || "").toLowerCase()).filter(Boolean))],
    styleTags: [...new Set(items.flatMap((x) => Array.isArray(x?.style_tags) ? x.style_tags : []).map((s) => (s || "").toLowerCase()).filter(Boolean))],
  };
  const existing = loadRecommendationFeedback(user);
  const updated = [entry, ...existing].slice(0, MAX_FEEDBACK_ENTRIES);
  const key = userKey(RECOMMENDATION_FEEDBACK_KEY, user);
  try { localStorage.setItem(key, JSON.stringify(updated)); } catch {}
}

export function dismissDuplicatePair(pairKey, user) {
  const list = loadDismissedDuplicates(user);
  if (!list.includes(pairKey)) list.push(pairKey);
  const key = userKey(DISMISSED_DUPLICATES_KEY, user);
  try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

export {
  GUEST_WARDROBE_KEY,
  WARDROBE_KEY,
  SAVED_OUTFITS_KEY,
  OUTFIT_HISTORY_KEY,
  PLANNED_OUTFITS_KEY,
  PROFILE_KEY,
  ONBOARDING_ANSWERS_KEY,
  ONBOARDED_KEY,
};
