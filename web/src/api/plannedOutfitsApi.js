import { makeLocalStore, PLANNED_OUTFITS_KEY } from "../utils/userStorage";
import { EVT_PLANNED_OUTFITS_CHANGED } from "../utils/constants";
import { makeId, normalizeItems, idsSignature } from "../utils/helpers";

const { read: readLocal, write: writeLocal } = makeLocalStore(PLANNED_OUTFITS_KEY, EVT_PLANNED_OUTFITS_CHANGED);

export const plannedOutfitsApi = {
  async listPlanned(user) {
    return { planned_outfits: readLocal(user) };
  },

  async planOutfit(payload, user) {
    const itemIds = Array.isArray(payload?.item_ids) ? payload.item_ids : [];
    const normalized = normalizeItems(itemIds);

    if (!normalized.length) {
      return { created: false, message: "Nothing to plan." };
    }

    const record = {
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

    const list = readLocal(user);
    const next = [record, ...list];
    writeLocal(next, user);

    return { created: true, message: "Outfit planned!", planned_outfit: record };
  },

  async removePlanned(id, user) {
    const list = readLocal(user);
    const next = list.filter((o) => (o?.planned_id || "") !== id);
    writeLocal(next, user);
    return { deleted: true };
  },
};
