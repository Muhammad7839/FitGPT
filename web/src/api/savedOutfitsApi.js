import { apiFetch, hasApi } from "./apiFetch";
import { userKey, SAVED_OUTFITS_KEY } from "../utils/userStorage";

const USE_LOCAL_FALLBACK = true;

const PATHS = {
  list: "/saved-outfits",
  create: "/saved-outfits",
};

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readLocal(user) {
  const key = userKey(SAVED_OUTFITS_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocal(list, user) {
  const key = userKey(SAVED_OUTFITS_KEY, user);
  localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
  window.dispatchEvent(new Event("fitgpt:saved-outfits-changed"));
}

function normalizeItems(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);

  cleaned.sort();
  return cleaned;
}

function signatureFromItems(items) {
  return normalizeItems(items).join("|");
}

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export const savedOutfitsApi = {
  normalizeItems,

  async listSaved(user) {
    if (USE_LOCAL_FALLBACK) {
      return { saved_outfits: readLocal(user) };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async unsaveOutfit(signature, user) {
    if (USE_LOCAL_FALLBACK) {
      const list = readLocal(user);
      const next = list.filter((o) => (o?.outfit_signature || "") !== signature);
      writeLocal(next, user);
      return { deleted: true };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(`${PATHS.list}/${encodeURIComponent(signature)}`, { method: "DELETE" });
  },

  async saveOutfit(payload, user) {
    const itemIds = Array.isArray(payload?.items) ? payload.items : [];
    const normalized = normalizeItems(itemIds);
    const sig = signatureFromItems(normalized);

    if (!sig) {
      return { created: false, message: "Nothing to save." };
    }

    if (USE_LOCAL_FALLBACK) {
      const list = readLocal(user);

      const exists = list.some((o) => (o?.outfit_signature || "") === sig);
      if (exists) {
        return { created: false, message: "This outfit is already in your saved outfits." };
      }

      const record = {
        saved_outfit_id: makeId(),
        user_id: "local-user",
        name: "",
        items: normalized,
        item_details: Array.isArray(payload?.item_details) ? payload.item_details : [],
        created_at: new Date().toISOString(),
        source: payload?.source || "recommended",
        context: payload?.context || {},
        notes: "",
        outfit_signature: sig,
      };

      const next = [record, ...list];
      writeLocal(next, user);

      return { created: true, message: "Saved.", saved_outfit: record };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");

    const res = await apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        items: normalized,
      }),
    });

    return res;
  },
};
