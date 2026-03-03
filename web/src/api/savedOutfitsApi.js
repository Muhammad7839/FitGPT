import { apiFetch, hasApi } from "./apiFetch";

const USE_LOCAL_FALLBACK = true; 

const LOCAL_KEY = "fitgpt_saved_outfits_v1";

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

function readLocal() {
  const raw = localStorage.getItem(LOCAL_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocal(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.isArray(list) ? list : []));
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

  async listSaved() {
    if (USE_LOCAL_FALLBACK) {
      return { saved_outfits: readLocal() };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async saveOutfit(payload) {
    const itemIds = Array.isArray(payload?.items) ? payload.items : [];
    const normalized = normalizeItems(itemIds);
    const sig = signatureFromItems(normalized);

    if (!sig) {
      return { created: false, message: "Nothing to save." };
    }

    if (USE_LOCAL_FALLBACK) {
      const list = readLocal();

      const exists = list.some((o) => (o?.outfit_signature || "") === sig);
      if (exists) {
        return { created: false, message: "This outfit is already in your saved outfits." };
      }

      const record = {
        saved_outfit_id: makeId(),
        user_id: "local-user",
        name: "",
        items: normalized,
        created_at: new Date().toISOString(),
        source: payload?.source || "recommended",
        context: payload?.context || {},
        notes: "",
        outfit_signature: sig,
      };

      const next = [record, ...list];
      writeLocal(next);

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