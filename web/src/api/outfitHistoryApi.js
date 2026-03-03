import { apiFetch, hasApi } from "./apiFetch";
import { userKey, OUTFIT_HISTORY_KEY } from "../utils/userStorage";

const USE_LOCAL_FALLBACK = true;

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

function readLocal(user) {
  const key = userKey(OUTFIT_HISTORY_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocal(list, user) {
  const key = userKey(OUTFIT_HISTORY_KEY, user);
  localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
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

  async listHistory(user) {
    if (USE_LOCAL_FALLBACK) {
      return { history: readLocal(user) };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(PATHS.list, { method: "GET" });
  },

  async removeBySignature(signature, user) {
    if (USE_LOCAL_FALLBACK) {
      const list = readLocal(user);
      const next = list.filter((h) => {
        const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
        const sig = normalizeItems(ids).join("|");
        return sig !== signature;
      });
      writeLocal(next, user);
      return { deleted: true };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(`${PATHS.list}/${encodeURIComponent(signature)}`, { method: "DELETE" });
  },

  async clearHistory(user) {
    if (USE_LOCAL_FALLBACK) {
      writeLocal([], user);
      return { cleared: true };
    }

    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch(PATHS.list, { method: "DELETE" });
  },

  async recordWorn(payload, user) {
    const itemIds = Array.isArray(payload?.item_ids) ? payload.item_ids : [];
    const normalized = normalizeItems(itemIds);

    if (!normalized.length) {
      return { created: false, message: "Nothing to record." };
    }

    if (USE_LOCAL_FALLBACK) {
      const list = readLocal(user);

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
      writeLocal(next, user);

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
