// Centralized per-user storage utility.
// Namespaces storage keys with user ID so each account has isolated data.
// Guests (no user) use the base key; signed-in users use baseKey_<userId>.

import { GUEST_WARDROBE_KEY, WARDROBE_KEY, SAVED_OUTFITS_KEY, OUTFIT_HISTORY_KEY, PLANNED_OUTFITS_KEY, PROFILE_KEY, ONBOARDING_ANSWERS_KEY, ONBOARDED_KEY, EVT_WARDROBE_CHANGED, REC_SEED_KEY, TIME_OVERRIDE_KEY, WEATHER_OVERRIDE_KEY, DEMO_AUTH_KEY, PROFILE_PIC_KEY, EVT_PROFILE_PIC_CHANGED, TUTORIAL_DONE_KEY } from "./constants";
import { safeParse } from "./helpers";

// Maps base key → which storage object it lives in
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

/** Extract stable user ID from user object. Returns null for guests. */
export function getUserId(user) {
  if (!user) return null;
  const id = user.id ?? user.user_id ?? user.email ?? user.demoEmail ?? null;
  const s = (id ?? "").toString().trim();
  return s || null;
}

/** Returns namespaced key for the user, or the base key for guests. */
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

/** Load wardrobe items for the given user (or guest). */
export function loadWardrobe(user) {
  const id = getUserId(user);
  const guestKey = userKey(GUEST_WARDROBE_KEY, user);
  const lsKey = userKey(WARDROBE_KEY, user);

  // Try namespaced keys first
  const guest = readArray(sessionStorage, guestKey);
  if (guest.length > 0) return guest;

  const ls = readArray(localStorage, lsKey);
  if (ls.length > 0) return ls;

  // For signed-in users, fall back to base (un-namespaced) keys.
  // Handles cases where migration hasn't run yet or was blocked.
  if (id) {
    const baseGuest = readArray(sessionStorage, GUEST_WARDROBE_KEY);
    if (baseGuest.length > 0) return baseGuest;

    const baseLs = readArray(localStorage, WARDROBE_KEY);
    if (baseLs.length > 0) return baseLs;
  }

  return [];
}

/** Save wardrobe items to sessionStorage (primary) and localStorage (durable). */
export function saveWardrobe(items, user) {
  const sessionKey = userKey(GUEST_WARDROBE_KEY, user);
  const localKey = userKey(WARDROBE_KEY, user);
  const safe = Array.isArray(items) ? items : [];
  const json = JSON.stringify(safe);
  try {
    sessionStorage.setItem(sessionKey, json);
    localStorage.setItem(localKey, json);
    window.dispatchEvent(new Event(EVT_WARDROBE_CHANGED));
  } catch (e) {
    console.warn("Storage quota exceeded, skipping save:", e);
  }
}

/**
 * Copy un-namespaced guest data to the user's namespaced keys.
 * Only copies if the namespaced key doesn't already have meaningful data.
 */
export function migrateGuestData(user) {
  const id = getUserId(user);
  if (!id) return;

  for (const { key: baseKey, storage } of KEY_STORAGE_MAP) {
    const namespacedKey = `${baseKey}_${id}`;
    const store = storage === "session" ? sessionStorage : localStorage;

    const baseRaw = store.getItem(baseKey);
    if (!baseRaw) continue;

    // Only skip if the namespaced key has meaningful data (not empty arrays)
    const existingRaw = store.getItem(namespacedKey);
    if (existingRaw) {
      const existingParsed = safeParse(existingRaw);
      const hasData = Array.isArray(existingParsed) ? existingParsed.length > 0 : !!existingParsed;
      if (hasData) continue;
    }

    store.setItem(namespacedKey, baseRaw);
  }
}

/** Remove all un-namespaced guest data after migration. */
export function clearGuestData() {
  for (const { key: baseKey, storage } of KEY_STORAGE_MAP) {
    const store = storage === "session" ? sessionStorage : localStorage;
    store.removeItem(baseKey);
  }
}

/**
 * Factory for per-user localStorage read/write with optional event dispatch.
 * Eliminates identical readLocal/writeLocal boilerplate across API modules.
 */
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

/**
 * Factory for per-user localStorage read/write for object values (e.g. profile).
 * Similar to makeLocalStore but defaults to {} instead of [].
 */
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

// ── Session-storage override helpers (Dashboard context chips) ──

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

// ── Demo auth helpers (Profile + TopNav) ──

export function readDemoAuth() {
  const raw = localStorage.getItem(DEMO_AUTH_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function writeDemoAuth(objOrNull) {
  if (!objOrNull) localStorage.removeItem(DEMO_AUTH_KEY);
  else localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(objOrNull));
}

// ── Onboarding persistence (AppRoutes) ──

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

// ── Profile picture helpers (Profile + TopNav) ──

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

// ── Tutorial flag ──

export function isTutorialDone() {
  return localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, "1");
  } catch {}
}

// Re-export key constants for use in event listener checks
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
