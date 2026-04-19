import { normalizeCategory } from "./recommendationEngine";

export const SLOTS = {
  BASE_TOP: "base_top",
  MID_TOP: "mid_top",
  OUTER_TOP: "outer_top",
  BOTTOM: "bottom",
  ONE_PIECE: "one_piece",
  SHOES: "shoes",
  HEADWEAR: "headwear",
  ACCESSORY: "accessory",
};

export const MAX_ACCESSORIES = 4;

const HEADWEAR_PATTERN = /(hat|cap|beanie|beret|helmet|visor|fedora|hood)/i;

export function getItemSlot(item) {
  if (!item) return null;

  const category = normalizeCategory(item.category);
  const layerType = (item.layer_type || "").toString().trim().toLowerCase();

  if (item.is_one_piece) return SLOTS.ONE_PIECE;

  if (category === "Tops") {
    if (layerType === "mid") return SLOTS.MID_TOP;
    if (layerType === "outer") return SLOTS.OUTER_TOP;
    return SLOTS.BASE_TOP;
  }

  if (category === "Outerwear") return SLOTS.OUTER_TOP;
  if (category === "Bottoms") return SLOTS.BOTTOM;
  if (category === "Shoes") return SLOTS.SHOES;

  if (category === "Accessories") {
    if (HEADWEAR_PATTERN.test(item.name || "")) return SLOTS.HEADWEAR;
    return SLOTS.ACCESSORY;
  }

  return null;
}

export function slotLabel(slot) {
  switch (slot) {
    case SLOTS.BASE_TOP:
      return "base top";
    case SLOTS.MID_TOP:
      return "mid layer";
    case SLOTS.OUTER_TOP:
      return "outer layer";
    case SLOTS.BOTTOM:
      return "bottom";
    case SLOTS.ONE_PIECE:
      return "one-piece";
    case SLOTS.SHOES:
      return "shoes";
    case SLOTS.HEADWEAR:
      return "headwear";
    case SLOTS.ACCESSORY:
      return "accessory";
    default:
      return slot || "";
  }
}

const LAYER_RANK = {
  [SLOTS.SHOES]: 0,
  [SLOTS.BOTTOM]: 1,
  [SLOTS.ONE_PIECE]: 2,
  [SLOTS.BASE_TOP]: 3,
  [SLOTS.MID_TOP]: 4,
  [SLOTS.OUTER_TOP]: 5,
  [SLOTS.HEADWEAR]: 6,
  [SLOTS.ACCESSORY]: 7,
};

export function layerOrdered(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  return [...items].sort((a, b) => {
    const aRank = LAYER_RANK[getItemSlot(a)] ?? 99;
    const bRank = LAYER_RANK[getItemSlot(b)] ?? 99;
    return aRank - bRank;
  });
}

export function validateOutfit(outfit) {
  const items = Array.isArray(outfit) ? outfit : [];
  const conflicts = [];
  const bySlot = {};
  const accessories = [];

  for (const item of items) {
    if (!item) continue;
    const slot = getItemSlot(item);
    if (!slot) continue;

    if (slot === SLOTS.ACCESSORY) {
      accessories.push(item);
      continue;
    }

    if (bySlot[slot]) {
      conflicts.push({
        type: "duplicate_slot",
        slot,
        itemIds: [bySlot[slot].id, item.id],
        itemNames: [bySlot[slot].name || "item", item.name || "item"],
        message: `Two items are using the ${slotLabel(slot)} slot: ${bySlot[slot].name || "item"} and ${item.name || "item"}.`,
      });
      continue;
    }

    bySlot[slot] = item;
  }

  if (bySlot[SLOTS.ONE_PIECE]) {
    for (const slot of [SLOTS.BASE_TOP, SLOTS.MID_TOP, SLOTS.BOTTOM]) {
      if (!bySlot[slot]) continue;
      conflicts.push({
        type: "one_piece_conflict",
        slot,
        itemIds: [bySlot[SLOTS.ONE_PIECE].id, bySlot[slot].id],
        itemNames: [bySlot[SLOTS.ONE_PIECE].name || "one-piece", bySlot[slot].name || "item"],
        message: `${bySlot[SLOTS.ONE_PIECE].name || "One-piece"} cannot be layered with a separate ${slotLabel(slot)}.`,
      });
    }
  }

  if (
    bySlot[SLOTS.OUTER_TOP] &&
    !bySlot[SLOTS.BASE_TOP] &&
    !bySlot[SLOTS.MID_TOP] &&
    !bySlot[SLOTS.ONE_PIECE]
  ) {
    conflicts.push({
      type: "outer_without_base",
      slot: SLOTS.OUTER_TOP,
      itemIds: [bySlot[SLOTS.OUTER_TOP].id],
      itemNames: [bySlot[SLOTS.OUTER_TOP].name || "outer layer"],
      message: `${bySlot[SLOTS.OUTER_TOP].name || "Outer layer"} should sit over a shirt or one-piece.`,
    });
  }

  if (accessories.length > MAX_ACCESSORIES) {
    conflicts.push({
      type: "too_many_accessories",
      slot: SLOTS.ACCESSORY,
      itemIds: accessories.map((item) => item.id),
      itemNames: accessories.map((item) => item.name || "accessory"),
      message: `Too many accessories (${accessories.length}). Max recommended: ${MAX_ACCESSORIES}.`,
    });
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    bySlot,
    accessories,
  };
}
