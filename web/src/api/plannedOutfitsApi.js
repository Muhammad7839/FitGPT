import { userKey, PLANNED_OUTFITS_KEY } from "../utils/userStorage";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readLocal(user) {
  const key = userKey(PLANNED_OUTFITS_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function writeLocal(list, user) {
  const key = userKey(PLANNED_OUTFITS_KEY, user);
  localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
  window.dispatchEvent(new Event("fitgpt:planned-outfits-changed"));
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

function signatureFromItems(items) {
  return normalizeItems(items).join("|");
}

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
      outfit_signature: signatureFromItems(normalized),
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
