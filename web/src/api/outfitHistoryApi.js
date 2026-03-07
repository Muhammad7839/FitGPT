import { apiFetch, hasApi } from "./apiFetch";
import { makeLocalStore, getUserId, OUTFIT_HISTORY_KEY } from "../utils/userStorage";
import { makeId, normalizeItems } from "../utils/helpers";

const USE_LOCAL_FALLBACK = true;

const PATHS = {
  list: "/outfit-history",
  create: "/outfit-history",
};

const { read: readLocal, write: writeLocal } = makeLocalStore(OUTFIT_HISTORY_KEY);

export const outfitHistoryApi = {
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
        user_id: getUserId(user) || "local-user",
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
