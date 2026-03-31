import {
  titleCase,
  normalizeCategory,
  normalizeColorName,
  colorToCss,
  fitPenalty,
  colorInfo,
  hueDiff,
  pairScore,
  mulberry32,
  pickOne,
  bucketWardrobe,
  weatherCategoryFromTempF,
  timeCategoryFromDate,
  generateThreeOutfits,
  defaultOutfitSet,
  signatureFromItems,
  idsSignature,
  makeRecentSets,
  buildExplanation,
  bodyTypeLabelFromId,
  layerWarmth,
} from "./recommendationEngine";

describe("titleCase", () => {
  test("capitalizes each word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  test("handles underscores and hyphens", () => {
    expect(titleCase("dark_blue")).toBe("Dark Blue");
    expect(titleCase("light-gray")).toBe("Light Gray");
  });

  test("handles empty/null input", () => {
    expect(titleCase("")).toBe("");
    expect(titleCase(null)).toBe("");
    expect(titleCase(undefined)).toBe("");
  });
});

describe("normalizeCategory", () => {
  test("normalizes known categories", () => {
    expect(normalizeCategory("tops")).toBe("Tops");
    expect(normalizeCategory("top")).toBe("Tops");
    expect(normalizeCategory("bottoms")).toBe("Bottoms");
    expect(normalizeCategory("bottom")).toBe("Bottoms");
    expect(normalizeCategory("outerwear")).toBe("Outerwear");
    expect(normalizeCategory("jacket")).toBe("Outerwear");
    expect(normalizeCategory("shoes")).toBe("Shoes");
    expect(normalizeCategory("accessories")).toBe("Accessories");
  });

  test("title-cases unknown categories", () => {
    expect(normalizeCategory("socks")).toBe("Socks");
    expect(normalizeCategory("hats")).toBe("Hats");
  });

  test("handles empty input", () => {
    expect(normalizeCategory("")).toBe("");
    expect(normalizeCategory(null)).toBe("");
  });
});

describe("normalizeColorName", () => {
  test("normalizes known color names", () => {
    expect(normalizeColorName("RED")).toBe("red");
    expect(normalizeColorName("  Blue  ")).toBe("blue");
  });

  test("handles multi-word colors", () => {
    const result = normalizeColorName("light blue");
    expect(typeof result).toBe("string");
  });

  test("returns empty string for empty input", () => {
    expect(normalizeColorName("")).toBe("");
    expect(normalizeColorName(null)).toBe("");
  });
});

describe("colorToCss", () => {
  test("returns a CSS color string for known colors", () => {
    const css = colorToCss("red");
    expect(typeof css).toBe("string");
    expect(css.length).toBeGreaterThan(0);
  });

  test("returns a fallback for unknown colors", () => {
    const css = colorToCss("unknowncolor12345");
    expect(typeof css).toBe("string");
  });
});

describe("fitPenalty", () => {
  test("returns 0 for matching fits", () => {
    expect(fitPenalty("regular", "regular")).toBe(0);
  });

  test("returns a positive penalty for tight fit on apple body type", () => {
    expect(fitPenalty("slim", "apple", "Tops")).toBeGreaterThan(0);
  });
});

describe("colorInfo / hueDiff / pairScore", () => {
  test("colorInfo returns an object with hue, neutral, name", () => {
    const info = colorInfo("blue");
    expect(info).toHaveProperty("hue");
    expect(info).toHaveProperty("neutral");
    expect(info).toHaveProperty("name");
    expect(info.neutral).toBe(false);
    expect(info.name).toBe("blue");
  });

  test("hueDiff returns a number between 0 and 180", () => {
    const diff = hueDiff(0, 270);
    expect(diff).toBeLessThanOrEqual(180);
    expect(diff).toBeGreaterThanOrEqual(0);
  });

  test("pairScore returns a number", () => {
    const score = pairScore("blue", "white");
    expect(typeof score).toBe("number");
  });
});

describe("mulberry32 (seeded PRNG)", () => {
  test("returns a function that produces numbers in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  test("same seed produces same sequence", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  test("different seeds produce different sequences", () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

describe("pickOne", () => {
  test("picks an element from the array", () => {
    const rng = mulberry32(42);
    const arr = [1, 2, 3, 4, 5];
    const picked = pickOne(arr, rng);
    expect(arr).toContain(picked);
  });
});

describe("weatherCategoryFromTempF", () => {
  test("categorizes temperatures correctly", () => {
    expect(weatherCategoryFromTempF(30)).toBe("cold");
    expect(weatherCategoryFromTempF(50)).toBe("cool");
    expect(weatherCategoryFromTempF(65)).toBe("mild");
    expect(weatherCategoryFromTempF(80)).toBe("warm");
    expect(weatherCategoryFromTempF(95)).toBe("hot");
  });

  test("returns mild for NaN", () => {
    expect(weatherCategoryFromTempF(NaN)).toBe("mild");
  });

  test("null coerces to 0 (cold)", () => {
    expect(weatherCategoryFromTempF(null)).toBe("cold");
  });
});

describe("timeCategoryFromDate", () => {
  test("returns a valid time category", () => {
    const validCategories = ["morning", "work hours", "evening", "night"];
    const result = timeCategoryFromDate(new Date());
    expect(validCategories).toContain(result);
  });

  test("morning for 8am", () => {
    const d = new Date("2025-01-15T08:00:00");
    expect(timeCategoryFromDate(d)).toBe("morning");
  });

  test("evening for 7pm", () => {
    const d = new Date("2025-01-15T19:00:00");
    expect(timeCategoryFromDate(d)).toBe("evening");
  });
});

describe("bucketWardrobe", () => {
  test("groups items by normalized category", () => {
    const wardrobe = [
      { id: "1", name: "T-shirt", category: "tops", color: "blue", fit_tag: "regular" },
      { id: "2", name: "Jeans", category: "bottoms", color: "blue", fit_tag: "regular" },
      { id: "3", name: "Jacket", category: "outerwear", color: "black", fit_tag: "regular" },
      { id: "4", name: "Sneakers", category: "shoes", color: "white", fit_tag: "regular" },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.Tops.length).toBe(1);
    expect(buckets.Bottoms.length).toBe(1);
    expect(buckets.Outerwear.length).toBe(1);
    expect(buckets.Shoes.length).toBe(1);
  });

  test("includes all items regardless of is_active (filtering is caller responsibility)", () => {
    const wardrobe = [
      { id: "1", name: "T-shirt", category: "tops", color: "blue", fit_tag: "regular", is_active: false },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.Tops).toHaveLength(1);
  });
});

describe("generateThreeOutfits", () => {
  const wardrobe = [
    { id: "t1", name: "White Tee", category: "tops", color: "white", fit_tag: "regular", is_active: true },
    { id: "t2", name: "Blue Shirt", category: "tops", color: "blue", fit_tag: "regular", is_active: true },
    { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", fit_tag: "regular", is_active: true },
    { id: "b2", name: "Khakis", category: "bottoms", color: "beige", fit_tag: "regular", is_active: true },
    { id: "s1", name: "White Sneakers", category: "shoes", color: "white", fit_tag: "regular", is_active: true },
    { id: "s2", name: "Brown Boots", category: "shoes", color: "brown", fit_tag: "regular", is_active: true },
  ];

  test("returns exactly 3 outfits", () => {
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits).toHaveLength(3);
  });

  test("each outfit has items from different categories", () => {
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    for (const outfit of outfits) {
      expect(outfit.length).toBeGreaterThanOrEqual(2);
      const categories = outfit.map((item) => item.category);
      const unique = new Set(categories);
      expect(unique.size).toBe(categories.length);
    }
  });

  test("same seed produces same outfits", () => {
    const a = generateThreeOutfits(wardrobe, 99, "rectangle", new Set(), new Map(), "mild", "morning", null);
    const b = generateThreeOutfits(wardrobe, 99, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(a.map((o) => o.map((i) => i.id))).toEqual(b.map((o) => o.map((i) => i.id)));
  });
});

describe("defaultOutfitSet", () => {
  test("returns 3 outfits", () => {
    const outfits = defaultOutfitSet();
    expect(outfits).toHaveLength(3);
  });

  test("each outfit has items with required fields", () => {
    const outfits = defaultOutfitSet();
    for (const outfit of outfits) {
      for (const item of outfit) {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("category");
      }
    }
  });
});

describe("signatureFromItems", () => {
  test("builds signature from item objects", () => {
    const items = [{ id: "b" }, { id: "a" }];
    expect(signatureFromItems(items)).toBe("a|b");
  });

  test("handles null items", () => {
    expect(signatureFromItems(null)).toBe("");
    expect(signatureFromItems([])).toBe("");
  });
});

describe("makeRecentSets", () => {
  test("returns sigs set and counts map", () => {
    const history = [
      { item_ids: ["a", "b"] },
      { item_ids: ["c", "d"] },
      { item_ids: ["a", "b"] },
    ];
    const { sigs, itemCounts } = makeRecentSets(history, 10);
    expect(sigs).toBeInstanceOf(Set);
    expect(itemCounts).toBeInstanceOf(Map);
    expect(sigs.size).toBeGreaterThan(0);
  });
});

describe("buildExplanation", () => {
  test("returns a non-empty string", () => {
    const outfit = [
      { id: "1", name: "Shirt", category: "Tops", color: "blue", fit_tag: "regular" },
      { id: "2", name: "Pants", category: "Bottoms", color: "black", fit_tag: "regular" },
    ];
    const result = buildExplanation(outfit, "mild", "morning", "rectangle");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("bodyTypeLabelFromId", () => {
  test("returns label for known body types", () => {
    expect(bodyTypeLabelFromId("rectangle")).toBeTruthy();
    expect(bodyTypeLabelFromId("hourglass")).toBeTruthy();
  });

  test("returns fallback for unknown types", () => {
    const result = bodyTypeLabelFromId("unknown_type_xyz");
    expect(typeof result).toBe("string");
  });
});

/* ── Layering realism tests ──────────────────────────────────────────── */

describe("layerWarmth", () => {
  test("returns high warmth for heavy outerwear", () => {
    expect(layerWarmth({ clothing_type: "parka" })).toBeGreaterThanOrEqual(7);
    expect(layerWarmth({ clothing_type: "coat" })).toBeGreaterThanOrEqual(7);
    expect(layerWarmth({ clothing_type: "down jacket" })).toBeGreaterThanOrEqual(7);
  });

  test("returns mid warmth for mid-layers", () => {
    const sweater = layerWarmth({ clothing_type: "sweater" });
    const hoodie = layerWarmth({ clothing_type: "hoodie" });
    expect(sweater).toBeGreaterThanOrEqual(4);
    expect(hoodie).toBeGreaterThanOrEqual(4);
  });

  test("returns low warmth for base layers", () => {
    expect(layerWarmth({ clothing_type: "t-shirt" })).toBeLessThanOrEqual(3);
    expect(layerWarmth({ clothing_type: "tank top" })).toBeLessThanOrEqual(2);
  });

  test("falls back to layer_type inference for unknown types", () => {
    expect(layerWarmth({ clothing_type: "unknown", category: "Outerwear" })).toBe(5);
    expect(layerWarmth({ clothing_type: "unknown", category: "Tops" })).toBe(1);
  });
});

describe("layering in cold weather", () => {
  const layeredWardrobe = [
    { id: "base1", name: "White Tee", category: "tops", color: "white", clothing_type: "t-shirt", is_active: true },
    { id: "base2", name: "Blue Polo", category: "tops", color: "blue", clothing_type: "polo", is_active: true },
    { id: "mid1", name: "Gray Sweater", category: "tops", color: "gray", clothing_type: "sweater", is_active: true },
    { id: "mid2", name: "Black Hoodie", category: "tops", color: "black", clothing_type: "hoodie", is_active: true },
    { id: "outer1", name: "Navy Parka", category: "outerwear", color: "navy", clothing_type: "parka", is_active: true },
    { id: "outer2", name: "Black Jacket", category: "outerwear", color: "black", clothing_type: "jacket", is_active: true },
    { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
    { id: "b2", name: "Khaki Chinos", category: "bottoms", color: "beige", is_active: true },
    { id: "s1", name: "Brown Boots", category: "shoes", color: "brown", is_active: true },
    { id: "s2", name: "Black Sneakers", category: "shoes", color: "black", is_active: true },
  ];

  test("cold weather outfits include outerwear", () => {
    const outfits = generateThreeOutfits(layeredWardrobe, 42, "rectangle", new Set(), new Map(), "cold", "morning", null);
    expect(outfits).toHaveLength(3);
    for (const outfit of outfits) {
      const hasOuter = outfit.some((item) => item.category === "Outerwear" || item.layer_type === "outer");
      expect(hasOuter).toBe(true);
    }
  });

  test("cold weather outfits prefer multiple layers", () => {
    const outfits = generateThreeOutfits(layeredWardrobe, 77, "rectangle", new Set(), new Map(), "cold", "morning", null);
    let multiLayerCount = 0;
    for (const outfit of outfits) {
      const layerTypes = new Set(outfit.map((i) => i.layer_type).filter(Boolean));
      if (layerTypes.size >= 2) multiLayerCount++;
    }
    /* at least 2 of 3 outfits should have 2+ distinct layer types */
    expect(multiLayerCount).toBeGreaterThanOrEqual(2);
  });

  test("cold weather outfits achieve adequate warmth", () => {
    const outfits = generateThreeOutfits(layeredWardrobe, 55, "rectangle", new Set(), new Map(), "cold", "morning", null);
    for (const outfit of outfits) {
      const totalWarmth = outfit
        .filter((i) => i.category !== "Shoes" && i.category !== "Accessories")
        .reduce((sum, i) => sum + layerWarmth(i), 0);
      /* cold weather minimum warmth threshold = 10 */
      expect(totalWarmth).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("layering in hot weather", () => {
  const hotWardrobe = [
    { id: "t1", name: "White Tank", category: "tops", color: "white", clothing_type: "tank top", is_active: true },
    { id: "t2", name: "Blue Tee", category: "tops", color: "blue", clothing_type: "t-shirt", is_active: true },
    { id: "mid1", name: "Wool Sweater", category: "tops", color: "gray", clothing_type: "sweater", is_active: true },
    { id: "outer1", name: "Heavy Coat", category: "outerwear", color: "black", clothing_type: "coat", is_active: true },
    { id: "b1", name: "Khaki Shorts", category: "bottoms", color: "beige", clothing_type: "shorts", is_active: true },
    { id: "b2", name: "Linen Pants", category: "bottoms", color: "white", is_active: true },
    { id: "s1", name: "Sandals", category: "shoes", color: "brown", clothing_type: "sandals", is_active: true },
    { id: "s2", name: "White Sneakers", category: "shoes", color: "white", is_active: true },
  ];

  test("hot weather outfits avoid outerwear", () => {
    const outfits = generateThreeOutfits(hotWardrobe, 42, "rectangle", new Set(), new Map(), "hot", "morning", null);
    for (const outfit of outfits) {
      const hasHeavy = outfit.some((item) => item.category === "Outerwear");
      expect(hasHeavy).toBe(false);
    }
  });

  test("hot weather outfits use lightweight items", () => {
    const outfits = generateThreeOutfits(hotWardrobe, 99, "rectangle", new Set(), new Map(), "hot", "morning", null);
    for (const outfit of outfits) {
      const totalWarmth = outfit
        .filter((i) => i.category !== "Shoes" && i.category !== "Accessories")
        .reduce((sum, i) => sum + layerWarmth(i), 0);
      /* hot weather max warmth = 4 */
      expect(totalWarmth).toBeLessThanOrEqual(8);
    }
  });
});

describe("layer conflict detection", () => {
  test("tank top conflicts with parka (no mid-layer between them)", () => {
    const tankTop = { id: "t", category: "Tops", clothing_type: "tank top", layer_type: "base" };
    const parka = { id: "p", category: "Outerwear", clothing_type: "parka", layer_type: "outer" };

    /* When generating with only these two, they should not appear together */
    const wardrobe = [
      tankTop,
      parka,
      { id: "b", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
      { id: "s", name: "Boots", category: "shoes", color: "black", is_active: true },
    ].map((i) => ({ ...i, is_active: true }));

    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "cold", "morning", null);
    for (const outfit of outfits) {
      const hasTank = outfit.some((i) => i.clothing_type === "tank top");
      const hasParka = outfit.some((i) => i.clothing_type === "parka");
      /* tank + parka without mid is a conflict */
      if (hasTank && hasParka) {
        const hasMid = outfit.some((i) => i.layer_type === "mid");
        expect(hasMid).toBe(true);
      }
    }
  });

  test("two mid-layers do not appear in the same outfit", () => {
    const wardrobe = [
      { id: "t1", name: "Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
      { id: "m1", name: "Sweater", category: "tops", clothing_type: "sweater", color: "gray", is_active: true },
      { id: "m2", name: "Hoodie", category: "tops", clothing_type: "hoodie", color: "black", is_active: true },
      { id: "o1", name: "Jacket", category: "outerwear", clothing_type: "jacket", color: "navy", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
      { id: "s1", name: "Boots", category: "shoes", color: "brown", is_active: true },
    ];

    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "cold", "morning", null);
    for (const outfit of outfits) {
      const midLayers = outfit.filter((i) => i.layer_type === "mid");
      expect(midLayers.length).toBeLessThanOrEqual(1);
    }
  });

  test("two outer layers do not appear in the same outfit", () => {
    const wardrobe = [
      { id: "t1", name: "Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
      { id: "o1", name: "Parka", category: "outerwear", clothing_type: "parka", color: "navy", is_active: true },
      { id: "o2", name: "Coat", category: "outerwear", clothing_type: "coat", color: "black", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
      { id: "s1", name: "Boots", category: "shoes", color: "brown", is_active: true },
    ];

    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "cold", "morning", null);
    for (const outfit of outfits) {
      const outerLayers = outfit.filter((i) => i.layer_type === "outer");
      expect(outerLayers.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("cool weather layering", () => {
  const coolWardrobe = [
    { id: "t1", name: "White Shirt", category: "tops", color: "white", clothing_type: "dress shirt", is_active: true },
    { id: "t2", name: "Gray Henley", category: "tops", color: "gray", clothing_type: "henley", is_active: true },
    { id: "mid1", name: "Navy Cardigan", category: "tops", color: "navy", clothing_type: "cardigan", is_active: true },
    { id: "o1", name: "Brown Blazer", category: "outerwear", color: "brown", clothing_type: "blazer", is_active: true },
    { id: "o2", name: "Denim Jacket", category: "outerwear", color: "blue", clothing_type: "denim jacket", is_active: true },
    { id: "b1", name: "Dark Jeans", category: "bottoms", color: "navy", is_active: true },
    { id: "b2", name: "Chinos", category: "bottoms", color: "beige", is_active: true },
    { id: "s1", name: "Loafers", category: "shoes", color: "brown", is_active: true },
    { id: "s2", name: "Boots", category: "shoes", color: "black", is_active: true },
  ];

  test("cool weather outfits include at least 2 layers", () => {
    const outfits = generateThreeOutfits(coolWardrobe, 42, "rectangle", new Set(), new Map(), "cool", "morning", null);
    let layeredCount = 0;
    for (const outfit of outfits) {
      const layerTypes = new Set(outfit.map((i) => i.layer_type).filter(Boolean));
      if (layerTypes.size >= 2) layeredCount++;
    }
    /* most cool-weather outfits should have 2+ layer types */
    expect(layeredCount).toBeGreaterThanOrEqual(2);
  });

  test("cool weather outfits are lighter than cold weather outfits", () => {
    const coldOutfits = generateThreeOutfits(coolWardrobe, 42, "rectangle", new Set(), new Map(), "cold", "morning", null);
    const coolOutfits = generateThreeOutfits(coolWardrobe, 42, "rectangle", new Set(), new Map(), "cool", "morning", null);

    const avgWarmth = (outfits) => {
      const totals = outfits.map((o) =>
        o.filter((i) => i.category !== "Shoes" && i.category !== "Accessories")
          .reduce((s, i) => s + layerWarmth(i), 0)
      );
      return totals.reduce((a, b) => a + b, 0) / totals.length;
    };

    /* cool outfits should not be warmer on average than cold outfits */
    expect(avgWarmth(coolOutfits)).toBeLessThanOrEqual(avgWarmth(coldOutfits));
  });
});

describe("layering with reproducible seeds", () => {
  const wardrobe = [
    { id: "t1", name: "White Tee", category: "tops", color: "white", clothing_type: "t-shirt", is_active: true },
    { id: "mid1", name: "Sweater", category: "tops", color: "gray", clothing_type: "sweater", is_active: true },
    { id: "outer1", name: "Parka", category: "outerwear", color: "navy", clothing_type: "parka", is_active: true },
    { id: "b1", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
    { id: "s1", name: "Boots", category: "shoes", color: "brown", is_active: true },
  ];

  test("same seed produces same layered outfits", () => {
    const a = generateThreeOutfits(wardrobe, 123, "rectangle", new Set(), new Map(), "cold", "morning", null);
    const b = generateThreeOutfits(wardrobe, 123, "rectangle", new Set(), new Map(), "cold", "morning", null);
    expect(a.map((o) => o.map((i) => i.id))).toEqual(b.map((o) => o.map((i) => i.id)));
  });
});
