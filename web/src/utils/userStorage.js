// Centralized per-user storage utility.
// Namespaces storage keys with user ID so each account has isolated data.
// Guests (no user) use the base key; signed-in users use baseKey_<userId>.

const GUEST_WARDROBE_KEY = "fitgpt_guest_wardrobe_v1";
const WARDROBE_KEY = "fitgpt_wardrobe_v1";
const SAVED_OUTFITS_KEY = "fitgpt_saved_outfits_v1";
const OUTFIT_HISTORY_KEY = "fitgpt_outfit_history_v1";
const PLANNED_OUTFITS_KEY = "fitgpt_planned_outfits_v1";
const PROFILE_KEY = "fitgpt_profile_v1";
const ONBOARDING_ANSWERS_KEY = "fitgpt_onboarding_answers_v1";
const ONBOARDED_KEY = "fitgpt_onboarded_v1";

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

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
    window.dispatchEvent(new Event("fitgpt:guest-wardrobe-changed"));
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
