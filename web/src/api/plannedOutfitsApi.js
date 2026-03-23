import { apiFetch, hasApi } from "./apiFetch";
import { makeLocalStore, PLANNED_OUTFITS_KEY } from "../utils/userStorage";
import { EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { makeId, normalizeItems, idsSignature } from "../utils/helpers";

const PATHS = {
  list: "/planned-outfits",
  create: "/planned-outfits",
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

export const plannedOutfitsApi = {
  async listPlanned(user) {
    if (!canUseApi(user)) {
      return { planned_outfits: readLocal(user) };
    }

    try {
      const res = await apiFetch(PATHS.list, { method: "GET" });
      const remote = Array.isArray(res?.planned_outfits) ? res.planned_outfits : [];
      const merged = mergePlannedOutfits(remote, readLocal(user));
      writeLocal(merged, user);
      return { planned_outfits: merged };
    } catch {
      return { planned_outfits: readLocal(user) };
    }
  },

  async planOutfit(payload, user) {
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
        if (res?.planned_outfit) {
          writeLocal([res.planned_outfit, ...readLocal(user)], user);
        }
        return res;
      } catch {}
    }

    const record = buildLocalRecord(payload, normalized);
    writeLocal([record, ...readLocal(user)], user);
    return { created: true, message: "Outfit planned!", planned_outfit: record };
  },

  async removePlanned(id, user) {
    writeLocal(readLocal(user).filter((o) => (o?.planned_id || "") !== id), user);

    if (!canUseApi(user)) {
      return { deleted: true };
    }

    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return { deleted: true };
    }

    try {
      return await apiFetch(`${PATHS.list}/${numericId}`, { method: "DELETE" });
    } catch {
      return { deleted: true };
    }
  },
};
