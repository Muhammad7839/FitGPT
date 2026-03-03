import { apiFetch, hasApi } from "./apiFetch";

const USE_LOCAL_FALLBACK = true; 
const LOCAL_KEY = "fitgpt_outfit_history_v1";

const PATHS = {
  list: "/outfit-history",
  create: "/outfit-history",
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

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeItems(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((x) => (x ?? "").toString().trim())
    .filter(Boolean);

  cleaned.sort();
  return cleaned;
}

function pickUserId(payload) {
  const u = payload?.user;
  const id =
    u?.id ??
    u?.user_id ??
    u?.user?.id ??
    u?.user?.user_id ??
    u?.email ??
    u?.user?.email ??
    "";

  const s = (id ?? "").toString().trim();
  return s || "local-user";
}

export const outfitHistoryApi = {
  normalizeItems,

  async listHistory() {
    if (USE_LOCAL_FALLBACK) {
      return { history: readLocal() };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async recordWorn(payload) {
    const itemIds = Array.isArray(payload?.item_ids) ? payload.item_ids : [];
    const normalized = normalizeItems(itemIds);

    if (!normalized.length) {
      return { created: false, message: "Nothing to record." };
    }

    if (USE_LOCAL_FALLBACK) {
      const list = readLocal();

      const record = {
        history_id: makeId(),
        user_id: pickUserId(payload),
        item_ids: normalized,
        worn_at: new Date().toISOString(),
        source: payload?.source || "recommendation",
        context: payload?.context || {},
        confidence_score:
          typeof payload?.confidence_score === "number" ? payload.confidence_score : null,
      };

      const next = [record, ...list];
      writeLocal(next);

      return { created: true, message: "Added to history.", history_entry: record };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");

    return apiFetch(PATHS.create, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        item_ids: normalized,
      }),
    });
  },
};