import { apiFetch, hasApi } from "./apiFetch";
import { makeLocalStore, getUserId, OUTFIT_HISTORY_KEY } from "../utils/userStorage";
import { makeId, normalizeItems } from "../utils/helpers";

const PATHS = {
  list: "/outfit-history",
  create: "/outfit-history",
};

const { read: readLocal, write: writeLocal } = makeLocalStore(OUTFIT_HISTORY_KEY);

function canUseApi(user) {
  return !!user && hasApi();
}

function buildLocalRecord(payload, normalized, user) {
  return {
    history_id: makeId(),
    user_id: getUserId(user) || "local-user",
    item_ids: normalized,
    worn_at: new Date().toISOString(),
    source: payload?.source || "recommendation",
    context: payload?.context || {},
    confidence_score: typeof payload?.confidence_score === "number" ? payload.confidence_score : null,
  };
}

function historyEntryKey(entry) {
  const id = (entry?.history_id || "").toString().trim();
  if (id) return `id:${id}`;
  const wornAt = (entry?.worn_at || "").toString().trim();
  const sig = normalizeItems(Array.isArray(entry?.item_ids) ? entry.item_ids : []).join("|");
  if (wornAt || sig) return `sig:${wornAt}|${sig}`;
  return "";
}

function mergeHistoryEntries(remoteList, localList) {
  const merged = [];
  const seen = new Set();

  for (const entry of Array.isArray(remoteList) ? remoteList : []) {
    const key = historyEntryKey(entry);
    if (key) seen.add(key);
    merged.push(entry);
  }

  for (const entry of Array.isArray(localList) ? localList : []) {
    const key = historyEntryKey(entry);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(entry);
  }

  return merged;
}

function buildSyncFallback(result, _error) {
  return {
    ...result,
    localOnly: true,
    syncError: true,
  };
}

export const outfitHistoryApi = {
  async listHistory(user) {
    if (!user) {
      return { history: [] };
    }

    if (!canUseApi(user)) {
      return { history: readLocal(user) };
    }

    try {
      const res = await apiFetch(PATHS.list, { method: "GET" });
      const remote = Array.isArray(res?.history) ? res.history : [];
      const merged = mergeHistoryEntries(remote, readLocal(user));
      writeLocal(merged, user);
      return { history: merged };
    } catch {
      return { history: readLocal(user) };
    }
  },

  async removeBySignature(signature, user) {
    if (!user) {
      return { deleted: false, message: "Sign in to manage outfit history." };
    }

    const next = readLocal(user).filter((h) => {
      const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
      const sig = normalizeItems(ids).join("|");
      return sig !== signature;
    });
    writeLocal(next, user);

    if (!canUseApi(user)) {
      return { deleted: true };
    }

    try {
      return await apiFetch(`${PATHS.list}/${encodeURIComponent(signature)}`, { method: "DELETE" });
    } catch (error) {
      return buildSyncFallback({ deleted: true }, error);
    }
  },

  async clearHistory(user) {
    if (!user) {
      return { cleared: false, message: "Sign in to manage outfit history." };
    }

    writeLocal([], user);

    if (!canUseApi(user)) {
      return { cleared: true };
    }

    try {
      return await apiFetch(PATHS.list, { method: "DELETE" });
    } catch (error) {
      return buildSyncFallback({ cleared: true }, error);
    }
  },

  async recordWorn(payload, user) {
    if (!user) {
      return { created: false, message: "Sign in to track outfit history." };
    }

    const itemIds = Array.isArray(payload?.item_ids) ? payload.item_ids : [];
    const normalized = normalizeItems(itemIds);

    if (!normalized.length) {
      return { created: false, message: "Nothing to record." };
    }

    if (canUseApi(user)) {
      try {
        const res = await apiFetch(PATHS.create, {
          method: "POST",
          body: JSON.stringify({ ...payload, item_ids: normalized }),
        });
        if (res?.history_entry) {
          writeLocal([res.history_entry, ...readLocal(user)], user);
        }
        return res;
      } catch (error) {
        const record = buildLocalRecord(payload, normalized, user);
        writeLocal([record, ...readLocal(user)], user);
        return buildSyncFallback(
          { created: true, message: "Added to history.", history_entry: record },
          error
        );
      }
    }

    const record = buildLocalRecord(payload, normalized, user);
    writeLocal([record, ...readLocal(user)], user);
    return { created: true, message: "Added to history.", history_entry: record };
  },
};
