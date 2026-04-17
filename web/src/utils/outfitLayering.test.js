import {
  SLOTS,
  MAX_ACCESSORIES,
  getItemSlot,
  validateOutfit,
  canAdd,
  isCompleteOutfit,
  layerOrdered,
  slotLabel,
} from "./outfitLayering";

const T_SHIRT = { id: "t1", name: "White Tee", category: "Tops", color: "white" };
const FLANNEL = { id: "f1", name: "Red Flannel", category: "Tops", color: "red", layer_type: "mid" };
const JACKET = { id: "j1", name: "Denim Jacket", category: "Outerwear", color: "blue" };
const PANTS = { id: "p1", name: "Black Jeans", category: "Bottoms", color: "black" };
const SHORTS = { id: "p2", name: "Khaki Shorts", category: "Bottoms", color: "beige" };
const DRESS = { id: "d1", name: "Summer Dress", category: "Tops", color: "pink", is_one_piece: true };
const SNEAKERS = { id: "s1", name: "White Sneakers", category: "Shoes", color: "white" };
const HEELS = { id: "s2", name: "Black Heels", category: "Shoes", color: "black" };
const HAT = { id: "a1", name: "Wool Beanie", category: "Accessories", color: "gray" };
const WATCH = { id: "a2", name: "Silver Watch", category: "Accessories", color: "gray" };

describe("getItemSlot", () => {
  test("maps basic tees to BASE_TOP", () => {
    expect(getItemSlot(T_SHIRT)).toBe(SLOTS.BASE_TOP);
  });

  test("maps layer_type=mid tops to MID_TOP", () => {
    expect(getItemSlot(FLANNEL)).toBe(SLOTS.MID_TOP);
  });

  test("maps Outerwear to OUTER_TOP", () => {
    expect(getItemSlot(JACKET)).toBe(SLOTS.OUTER_TOP);
  });

  test("maps Bottoms to BOTTOM", () => {
    expect(getItemSlot(PANTS)).toBe(SLOTS.BOTTOM);
  });

  test("maps is_one_piece=true to ONE_PIECE regardless of category", () => {
    expect(getItemSlot(DRESS)).toBe(SLOTS.ONE_PIECE);
  });

  test("maps Shoes to SHOES", () => {
    expect(getItemSlot(SNEAKERS)).toBe(SLOTS.SHOES);
  });

  test("maps headwear accessories (beanie/hat) to HEADWEAR", () => {
    expect(getItemSlot(HAT)).toBe(SLOTS.HEADWEAR);
  });

  test("maps non-headwear accessories (watch) to ACCESSORY", () => {
    expect(getItemSlot(WATCH)).toBe(SLOTS.ACCESSORY);
  });

  test("returns null for missing/unknown input", () => {
    expect(getItemSlot(null)).toBeNull();
    expect(getItemSlot({ name: "Mystery", category: "Unknown" })).toBeNull();
  });
});

describe("validateOutfit — happy paths", () => {
  test("empty outfit is valid", () => {
    expect(validateOutfit([]).valid).toBe(true);
  });

  test("classic outfit (tee + pants + shoes) is valid", () => {
    const res = validateOutfit([T_SHIRT, PANTS, SNEAKERS]);
    expect(res.valid).toBe(true);
    expect(res.conflicts).toHaveLength(0);
  });

  test("layered outfit (tee + flannel + jacket + pants + shoes) is valid", () => {
    const res = validateOutfit([T_SHIRT, FLANNEL, JACKET, PANTS, SNEAKERS]);
    expect(res.valid).toBe(true);
  });

  test("one-piece + shoes + hat is valid", () => {
    const res = validateOutfit([DRESS, HEELS, HAT]);
    expect(res.valid).toBe(true);
  });
});

describe("validateOutfit — conflict detection", () => {
  test("two bottoms flagged as duplicate_slot", () => {
    const res = validateOutfit([PANTS, SHORTS, T_SHIRT]);
    expect(res.valid).toBe(false);
    const c = res.conflicts.find((x) => x.type === "duplicate_slot");
    expect(c).toBeTruthy();
    expect(c.slot).toBe(SLOTS.BOTTOM);
  });

  test("two base tops flagged", () => {
    const other = { ...T_SHIRT, id: "t2", name: "Black Tee" };
    const res = validateOutfit([T_SHIRT, other]);
    expect(res.valid).toBe(false);
    expect(res.conflicts[0].slot).toBe(SLOTS.BASE_TOP);
  });

  test("two pairs of shoes flagged", () => {
    const res = validateOutfit([T_SHIRT, PANTS, SNEAKERS, HEELS]);
    const c = res.conflicts.find((x) => x.slot === SLOTS.SHOES);
    expect(c).toBeTruthy();
  });

  test("one-piece + separate top flagged as one_piece_conflict", () => {
    const res = validateOutfit([DRESS, T_SHIRT]);
    expect(res.valid).toBe(false);
    const c = res.conflicts.find((x) => x.type === "one_piece_conflict");
    expect(c).toBeTruthy();
  });

  test("one-piece + bottom flagged", () => {
    const res = validateOutfit([DRESS, PANTS]);
    const c = res.conflicts.find((x) => x.type === "one_piece_conflict");
    expect(c).toBeTruthy();
    expect(c.slot).toBe(SLOTS.BOTTOM);
  });

  test("outer without base/mid/one-piece flagged as outer_without_base", () => {
    const res = validateOutfit([JACKET, PANTS, SNEAKERS]);
    const c = res.conflicts.find((x) => x.type === "outer_without_base");
    expect(c).toBeTruthy();
  });

  test("outer over base shirt does NOT trigger outer_without_base", () => {
    const res = validateOutfit([T_SHIRT, JACKET, PANTS, SNEAKERS]);
    const c = res.conflicts.find((x) => x.type === "outer_without_base");
    expect(c).toBeFalsy();
  });

  test("outer over one-piece does NOT trigger outer_without_base", () => {
    const res = validateOutfit([DRESS, JACKET, SNEAKERS]);
    const c = res.conflicts.find((x) => x.type === "outer_without_base");
    expect(c).toBeFalsy();
  });

  test("too many accessories flagged", () => {
    const many = Array.from({ length: MAX_ACCESSORIES + 2 }, (_, i) => ({
      id: `acc${i}`, name: `Necklace ${i}`, category: "Accessories",
    }));
    const res = validateOutfit([T_SHIRT, PANTS, SNEAKERS, ...many]);
    const c = res.conflicts.find((x) => x.type === "too_many_accessories");
    expect(c).toBeTruthy();
  });
});

describe("canAdd", () => {
  test("adding compatible item returns valid", () => {
    const res = canAdd([T_SHIRT, PANTS], SNEAKERS);
    expect(res.valid).toBe(true);
  });

  test("adding duplicate slot item returns conflict", () => {
    const res = canAdd([PANTS, T_SHIRT], SHORTS);
    expect(res.valid).toBe(false);
    expect(res.conflicts[0].slot).toBe(SLOTS.BOTTOM);
  });
});

describe("isCompleteOutfit", () => {
  test("top + bottom + shoes is complete", () => {
    expect(isCompleteOutfit([T_SHIRT, PANTS, SNEAKERS])).toBe(true);
  });

  test("one-piece + shoes is complete", () => {
    expect(isCompleteOutfit([DRESS, HEELS])).toBe(true);
  });

  test("top + shoes (no bottom) is not complete", () => {
    expect(isCompleteOutfit([T_SHIRT, SNEAKERS])).toBe(false);
  });

  test("empty outfit is not complete", () => {
    expect(isCompleteOutfit([])).toBe(false);
  });
});

describe("layerOrdered", () => {
  test("orders shoes first, outer last", () => {
    const ordered = layerOrdered([JACKET, SNEAKERS, T_SHIRT, PANTS]);
    const slots = ordered.map(getItemSlot);
    expect(slots).toEqual([SLOTS.SHOES, SLOTS.BOTTOM, SLOTS.BASE_TOP, SLOTS.OUTER_TOP]);
  });

  test("handles empty", () => {
    expect(layerOrdered([])).toEqual([]);
  });
});

describe("slotLabel", () => {
  test("returns human-readable labels", () => {
    expect(slotLabel(SLOTS.BASE_TOP)).toBe("base top");
    expect(slotLabel(SLOTS.ONE_PIECE)).toBe("one-piece");
    expect(slotLabel("unknown_slot")).toBe("unknown_slot");
  });
});
