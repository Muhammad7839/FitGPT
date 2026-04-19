import { getItemSlot, layerOrdered, slotLabel, SLOTS, validateOutfit } from "./outfitLayering";

const tee = { id: "tee", name: "White Tee", category: "Tops", color: "white" };
const flannel = { id: "flannel", name: "Red Flannel", category: "Tops", color: "red", layer_type: "mid" };
const jacket = { id: "jacket", name: "Denim Jacket", category: "Outerwear", color: "blue" };
const jeans = { id: "jeans", name: "Black Jeans", category: "Bottoms", color: "black" };
const sneakers = { id: "sneakers", name: "White Sneakers", category: "Shoes", color: "white" };
const dress = { id: "dress", name: "Summer Dress", category: "Tops", color: "pink", is_one_piece: true };
const beanie = { id: "beanie", name: "Wool Beanie", category: "Accessories", color: "gray" };

describe("outfitLayering", () => {
  test("maps supported items into rendering slots", () => {
    expect(getItemSlot(tee)).toBe(SLOTS.BASE_TOP);
    expect(getItemSlot(flannel)).toBe(SLOTS.MID_TOP);
    expect(getItemSlot(jacket)).toBe(SLOTS.OUTER_TOP);
    expect(getItemSlot(jeans)).toBe(SLOTS.BOTTOM);
    expect(getItemSlot(sneakers)).toBe(SLOTS.SHOES);
    expect(getItemSlot(dress)).toBe(SLOTS.ONE_PIECE);
    expect(getItemSlot(beanie)).toBe(SLOTS.HEADWEAR);
  });

  test("accepts a complete layered outfit", () => {
    const result = validateOutfit([tee, flannel, jacket, jeans, sneakers]);

    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.bySlot[SLOTS.OUTER_TOP]).toEqual(jacket);
  });

  test("flags one-piece conflicts against separate tops and bottoms", () => {
    const result = validateOutfit([dress, tee, jeans]);

    expect(result.valid).toBe(false);
    expect(result.conflicts.map((conflict) => conflict.type)).toEqual(
      expect.arrayContaining(["one_piece_conflict", "one_piece_conflict"])
    );
  });

  test("flags outerwear without a base layer", () => {
    const result = validateOutfit([jacket, jeans, sneakers]);

    expect(result.valid).toBe(false);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "outer_without_base",
          slot: SLOTS.OUTER_TOP,
        }),
      ])
    );
  });

  test("orders items from base outfit structure to outer layers", () => {
    const ordered = layerOrdered([jacket, sneakers, tee, jeans, beanie]);

    expect(ordered.map(getItemSlot)).toEqual([
      SLOTS.SHOES,
      SLOTS.BOTTOM,
      SLOTS.BASE_TOP,
      SLOTS.OUTER_TOP,
      SLOTS.HEADWEAR,
    ]);
  });

  test("returns readable labels for slots", () => {
    expect(slotLabel(SLOTS.BASE_TOP)).toBe("base top");
    expect(slotLabel(SLOTS.ONE_PIECE)).toBe("one-piece");
    expect(slotLabel("unknown_slot")).toBe("unknown_slot");
  });
});
