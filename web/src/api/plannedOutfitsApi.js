import { apiFetch, hasApi } from "./apiFetch";
import { makeLocalStore, PLANNED_OUTFITS_KEY } from "../utils/userStorage";
import { EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { makeId, normalizeItems, idsSignature } from "../utils/helpers";

const PATHS = {
  list: "/outfits/planned",
  create: "/outfits/planned",
  remove: (id) => `/outfits/planned/${id}`,
};

const { read: readLocal, write: writeLocal } = makeLocalStore(PLANNED_OUTFITS_KEY, EVT_PLANNED_OUTFITS_CHANGED);

function canUseApi(user) {
  return !!user && hasApi();
}

function buildLocalRecord(payload, normalized) {
  return {
    planned_id: makeId(),
    item_ids: normalized,
    item_details: Array.isArray(payload?.item_details) ? payload.item_details : [],
    planned_date: payload?.planned_date || "",
    occasion: payload?.occasion || "",
    notes: payload?.notes || "",
    created_at: new Date().toISOString(),
    source: payload?.source || "planner",
    outfit_signature: idsSignature(normalized),
  };
}

function timestampToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return new Date(numeric * 1000).toISOString();
}

function normalizePlannedOutfit(outfit) {
  const itemIds = normalizeItems(Array.isArray(outfit?.item_ids) ? outfit.item_ids : []);
  return {
    planned_id: (outfit?.planned_id ?? outfit?.id ?? "").toString(),
    item_ids: itemIds,
    item_details: Array.isArray(outfit?.item_details) ? outfit.item_details : [],
    planned_date: (outfit?.planned_date || "").toString(),
    occasion: (outfit?.occasion || "").toString(),
    notes: (outfit?.notes || "").toString(),
    created_at: (outfit?.created_at || "").toString() || timestampToIso(outfit?.created_at_timestamp),
    source: (outfit?.source || "planner").toString(),
    outfit_signature: (outfit?.outfit_signature || idsSignature(itemIds)).toString(),
  };
}

function readPlannedOutfitsFromResponse(res) {
  const records = Array.isArray(res?.outfits)
    ? res.outfits
    : Array.isArray(res?.planned_outfits)
      ? res.planned_outfits
      : [];
  return records.map(normalizePlannedOutfit);
}

function plannedOutfitKey(outfit) {
  const id = (outfit?.planned_id || "").toString().trim();
  if (id) return `id:${id}`;
  const date = (outfit?.planned_date || "").toString().trim();
  const sig = (outfit?.outfit_signature || idsSignature(outfit?.item_ids || [])).toString().trim();
  if (date || sig) return `sig:${date}|${sig}`;
  return "";
}

function mergePlannedOutfits(remoteList, localList) {
  const merged = [];
  const seen = new Set();

  for (const outfit of Array.isArray(remoteList) ? remoteList : []) {
    const key = plannedOutfitKey(outfit);
    if (key) seen.add(key);
    merged.push(outfit);
  }

  for (const outfit of Array.isArray(localList) ? localList : []) {
    const key = plannedOutfitKey(outfit);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(outfit);
  }

  return merged;
}

function buildSyncFallback(result, error) {
  return {
    ...result,
    localOnly: true,
    syncError: error instanceof Error ? error.message : "Remote sync failed.",
  };
}

export const plannedOutfitsApi = {
  async listPlanned(user) {
    if (!user) {
      return { planned_outfits: [] };
    }

    if (!canUseApi(user)) {
      return { planned_outfits: readLocal(user) };
    }

    try {
      const res = await apiFetch(PATHS.list, { method: "GET" });
      const remote = readPlannedOutfitsFromResponse(res);
      const merged = mergePlannedOutfits(remote, readLocal(user));
      writeLocal(merged, user);
      return { planned_outfits: merged };
    } catch {
      return { planned_outfits: readLocal(user) };
    }
  },

  async planOutfit(payload, user) {
    if (!user) {
      return { created: false, message: "Sign in to save outfit plans." };
    }

    const itemIds = Array.isArray(payload?.item_ids) ? payload.item_ids : [];
    const normalized = normalizeItems(itemIds);

    if (!normalized.length) {
      return { created: false, message: "Nothing to plan." };
    }

    if (canUseApi(user)) {
      try {
        const res = await apiFetch(PATHS.create, {
          method: "POST",
          body: JSON.stringify({ ...payload, item_ids: normalized }),
        });
        const remote = readPlannedOutfitsFromResponse(res);
        if (remote.length > 0) {
          const merged = mergePlannedOutfits(remote, readLocal(user));
          writeLocal(merged, user);
          const createdRecord = remote.find((entry) =>
            entry.planned_date === (payload?.planned_date || "") &&
            entry.outfit_signature === idsSignature(normalized)
          ) || remote[0];
          return {
            created: true,
            message: "Outfit planned!",
            planned_outfit: createdRecord,
            planned_outfits: merged,
          };
        }
      } catch (error) {
        const record = buildLocalRecord(payload, normalized);
        writeLocal([record, ...readLocal(user)], user);
        return buildSyncFallback(
          { created: true, message: "Outfit planned!", planned_outfit: record },
          error
        );
      }
    }

    const record = buildLocalRecord(payload, normalized);
    writeLocal([record, ...readLocal(user)], user);
    return { created: true, message: "Outfit planned!", planned_outfit: record };
  },

  async removePlanned(id, user) {
    if (!user) {
      return { deleted: false, message: "Sign in to manage outfit plans." };
    }

    writeLocal(readLocal(user).filter((o) => (o?.planned_id || "") !== id), user);

    if (!canUseApi(user)) {
      return { deleted: true };
    }

    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return { deleted: true };
    }

    try {
      const res = await apiFetch(PATHS.remove(numericId), { method: "DELETE" });
      const remote = readPlannedOutfitsFromResponse(res);
      if (remote.length > 0) {
        writeLocal(mergePlannedOutfits(remote, readLocal(user)), user);
      }
      return { deleted: true, planned_outfits: remote };
    } catch (error) {
      return buildSyncFallback({ deleted: true }, error);
    }
  },
};
