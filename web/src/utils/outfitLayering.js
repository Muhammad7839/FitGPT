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
  const cat = normalizeCategory(item.category);
  const layer = (item.layer_type || "").toString().toLowerCase();

  if (item.is_one_piece) return SLOTS.ONE_PIECE;

  if (cat === "Tops") {
    if (layer === "mid") return SLOTS.MID_TOP;
    if (layer === "outer") return SLOTS.OUTER_TOP;
    return SLOTS.BASE_TOP;
  }
  if (cat === "Outerwear") return SLOTS.OUTER_TOP;
  if (cat === "Bottoms") return SLOTS.BOTTOM;
  if (cat === "Shoes") return SLOTS.SHOES;
  if (cat === "Accessories") {
    if (HEADWEAR_PATTERN.test(item.name || "")) return SLOTS.HEADWEAR;
    return SLOTS.ACCESSORY;
  }
  return null;
}

export function slotLabel(slot) {
  switch (slot) {
    case SLOTS.BASE_TOP: return "base top";
    case SLOTS.MID_TOP: return "mid layer";
    case SLOTS.OUTER_TOP: return "outer layer";
    case SLOTS.BOTTOM: return "bottom";
    case SLOTS.ONE_PIECE: return "one-piece";
    case SLOTS.SHOES: return "shoes";
    case SLOTS.HEADWEAR: return "headwear";
    case SLOTS.ACCESSORY: return "accessory";
    default: return slot || "";
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
    const ra = LAYER_RANK[getItemSlot(a)] ?? 99;
    const rb = LAYER_RANK[getItemSlot(b)] ?? 99;
    return ra - rb;
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
        message: `Two items in the ${slotLabel(slot)} slot: ${bySlot[slot].name || "item"} and ${item.name || "item"}.`,
      });
    } else {
      bySlot[slot] = item;
    }
  }

  if (bySlot[SLOTS.ONE_PIECE]) {
    for (const conflictSlot of [SLOTS.BASE_TOP, SLOTS.MID_TOP, SLOTS.BOTTOM]) {
      if (bySlot[conflictSlot]) {
        conflicts.push({
          type: "one_piece_conflict",
          slot: conflictSlot,
          itemIds: [bySlot[SLOTS.ONE_PIECE].id, bySlot[conflictSlot].id],
          itemNames: [bySlot[SLOTS.ONE_PIECE].name || "one-piece", bySlot[conflictSlot].name || "item"],
          message: `One-piece (${bySlot[SLOTS.ONE_PIECE].name || "dress"}) can't be layered with a separate ${slotLabel(conflictSlot)}.`,
        });
      }
    }
  }

  if (bySlot[SLOTS.OUTER_TOP] && !bySlot[SLOTS.BASE_TOP] && !bySlot[SLOTS.MID_TOP] && !bySlot[SLOTS.ONE_PIECE]) {
    conflicts.push({
      type: "outer_without_base",
      slot: SLOTS.OUTER_TOP,
      itemIds: [bySlot[SLOTS.OUTER_TOP].id],
      itemNames: [bySlot[SLOTS.OUTER_TOP].name || "outer layer"],
      message: `${bySlot[SLOTS.OUTER_TOP].name || "Outer layer"} should be worn over a shirt or one-piece.`,
    });
  }

  if (accessories.length > MAX_ACCESSORIES) {
    conflicts.push({
      type: "too_many_accessories",
      slot: SLOTS.ACCESSORY,
      itemIds: accessories.map((a) => a.id),
      itemNames: accessories.map((a) => a.name || "accessory"),
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

export function canAdd(outfit, newItem) {
  const items = Array.isArray(outfit) ? outfit : [];
  return validateOutfit([...items, newItem]);
}

export function isCompleteOutfit(outfit) {
  const { bySlot } = validateOutfit(outfit);
  const hasTop = !!bySlot[SLOTS.BASE_TOP] || !!bySlot[SLOTS.ONE_PIECE];
  const hasBottom = !!bySlot[SLOTS.BOTTOM] || !!bySlot[SLOTS.ONE_PIECE];
  const hasShoes = !!bySlot[SLOTS.SHOES];
  return hasTop && hasBottom && hasShoes;
}
