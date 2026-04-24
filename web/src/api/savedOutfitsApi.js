import { apiFetch, hasApi } from "./apiFetch";
import { makeLocalStore, SAVED_OUTFITS_KEY } from "../utils/userStorage";
import { EVT_SAVED_OUTFITS_CHANGED } from "../utils/constants";
import { makeId, normalizeItems, idsSignature } from "../utils/helpers";

const PATHS = {
  list: "/saved-outfits",
  create: "/saved-outfits",
};

const { read: readLocal, write: writeLocal } = makeLocalStore(SAVED_OUTFITS_KEY, EVT_SAVED_OUTFITS_CHANGED);

function canUseApi(user) {
  return !!user && hasApi();
}

function buildLocalRecord(payload, normalized, sig) {
  return {
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
}

function savedOutfitKey(outfit) {
  const id = (outfit?.saved_outfit_id || "").toString().trim();
  if (id) return `id:${id}`;
  const sig = (outfit?.outfit_signature || "").toString().trim();
  if (sig) return `sig:${sig}`;
  return "";
}

function mergeSavedOutfits(remoteList, localList) {
  const merged = [];
  const seen = new Set();

  for (const outfit of Array.isArray(remoteList) ? remoteList : []) {
    const key = savedOutfitKey(outfit);
    if (key) seen.add(key);
    merged.push(outfit);
  }

  for (const outfit of Array.isArray(localList) ? localList : []) {
    const key = savedOutfitKey(outfit);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(outfit);
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

export const savedOutfitsApi = {
  async listSaved(user) {
    if (!user) {
      return { saved_outfits: [] };
    }

    if (!canUseApi(user)) {
      return { saved_outfits: readLocal(user) };
    }

    try {
      const res = await apiFetch(PATHS.list, { method: "GET" });
      const remote = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];
      const merged = mergeSavedOutfits(remote, readLocal(user));
      writeLocal(merged, user);
      return { saved_outfits: merged };
    } catch {
      return { saved_outfits: readLocal(user) };
    }
  },

  async unsaveOutfit(signature, user) {
    if (!user) {
      return { deleted: false, message: "Sign in to manage saved outfits." };
    }

    const next = readLocal(user).filter((o) => (o?.outfit_signature || "") !== signature);
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

  async saveOutfit(payload, user) {
    if (!user) {
      return { created: false, message: "Sign in to save outfits." };
    }

    const itemIds = Array.isArray(payload?.items) ? payload.items : [];
    const normalized = normalizeItems(itemIds);
    const sig = idsSignature(normalized);

    if (!sig) {
      return { created: false, message: "Nothing to save." };
    }

    if (canUseApi(user)) {
      try {
        const res = await apiFetch(PATHS.create, {
          method: "POST",
          body: JSON.stringify({ ...payload, items: normalized }),
        });
        if (res?.saved_outfit) {
          const current = readLocal(user).filter((o) => (o?.outfit_signature || "") !== sig);
          writeLocal([res.saved_outfit, ...current], user);
        }
        return res;
      } catch (error) {
        const list = readLocal(user);
        const exists = list.some((o) => (o?.outfit_signature || "") === sig);
        if (exists) {
          return buildSyncFallback(
            { created: false, message: "This outfit is already in your saved outfits." },
            error
          );
        }

        const record = buildLocalRecord(payload, normalized, sig);
        writeLocal([record, ...list], user);
        return buildSyncFallback(
          { created: true, message: "Saved.", saved_outfit: record },
          error
        );
      }
    }

    const list = readLocal(user);
    const exists = list.some((o) => (o?.outfit_signature || "") === sig);
    if (exists) {
      return { created: false, message: "This outfit is already in your saved outfits." };
    }

    const record = buildLocalRecord(payload, normalized, sig);
    writeLocal([record, ...list], user);
    return { created: true, message: "Saved.", saved_outfit: record };
  },
};
