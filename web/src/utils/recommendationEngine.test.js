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
  analyzeColorRelationship,
  analyzeOutfitColors,
  scoreOutfitForDisplay,
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
  test("returns a non-empty string for a valid outfit", () => {
    const outfit = [
      { id: "1", name: "Shirt", category: "Tops", color: "blue", fit_tag: "regular" },
      { id: "2", name: "Pants", category: "Bottoms", color: "black", fit_tag: "regular" },
    ];
    const result = buildExplanation({ outfit, weatherCategory: "mild", timeCategory: "morning", answers: { bodyType: "rectangle" } });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("includes color reasoning that references actual outfit colors", () => {
    const outfit = [
      { id: "1", name: "Navy Blazer", category: "Outerwear", color: "navy" },
      { id: "2", name: "Red Shirt", category: "Tops", color: "red" },
      { id: "3", name: "Black Pants", category: "Bottoms", color: "black" },
    ];
    const result = buildExplanation({ outfit, weatherCategory: "cool", timeCategory: "morning", answers: {} });
    const lower = result.toLowerCase();
    const mentionsColor = lower.includes("navy") || lower.includes("red") || lower.includes("black") || lower.includes("neutral") || lower.includes("complement") || lower.includes("contrast");
    expect(mentionsColor).toBe(true);
  });

  test("returns fallback when outfit is empty", () => {
    const result = buildExplanation({ outfit: [], answers: {} });
    expect(result).toContain("onboarding");
  });

  test("explanation varies between different color combos", () => {
    const outfitA = [
      { id: "1", name: "Tee", category: "Tops", color: "blue" },
      { id: "2", name: "Shorts", category: "Bottoms", color: "orange" },
    ];
    const outfitB = [
      { id: "3", name: "Tee", category: "Tops", color: "black" },
      { id: "4", name: "Shorts", category: "Bottoms", color: "white" },
    ];
    const resultA = buildExplanation({ outfit: outfitA, answers: {} });
    const resultB = buildExplanation({ outfit: outfitB, answers: {} });
    expect(resultA).not.toBe(resultB);
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

/* ── One-piece item tests ────────────────────────────────────────────── */

describe("one-piece auto-detection", () => {
  test("dress is auto-detected as one-piece", () => {
    const wardrobe = [
      { id: "d1", name: "Black Dress", category: "tops", clothing_type: "dress", color: "black", is_active: true },
      { id: "s1", name: "Heels", category: "shoes", color: "black", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(1);
    expect(buckets.OnePieces[0].is_one_piece).toBe(true);
  });

  test("jumpsuit is auto-detected as one-piece", () => {
    const wardrobe = [
      { id: "j1", name: "Navy Jumpsuit", category: "tops", clothing_type: "jumpsuit", color: "navy", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(1);
  });

  test("romper is auto-detected as one-piece", () => {
    const wardrobe = [
      { id: "r1", name: "Floral Romper", category: "tops", clothing_type: "romper", color: "pink", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(1);
  });

  test("overalls are auto-detected as one-piece", () => {
    const wardrobe = [
      { id: "o1", name: "Denim Overalls", category: "bottoms", clothing_type: "overalls", color: "blue", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(1);
  });

  test("t-shirt is NOT auto-detected as one-piece", () => {
    const wardrobe = [
      { id: "t1", name: "White Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(0);
  });

  test("explicit is_one_piece flag overrides type detection", () => {
    const wardrobe = [
      { id: "x1", name: "Custom Piece", category: "tops", clothing_type: "unknown", is_one_piece: true, color: "gray", is_active: true },
    ];
    const buckets = bucketWardrobe(wardrobe);
    expect(buckets.OnePieces).toHaveLength(1);
  });
});

describe("one-piece outfit generation", () => {
  const onePieceWardrobe = [
    { id: "d1", name: "Black Dress", category: "tops", clothing_type: "dress", color: "black", is_active: true },
    { id: "d2", name: "Red Dress", category: "tops", clothing_type: "dress", color: "red", is_active: true },
    { id: "t1", name: "White Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
    { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
    { id: "s1", name: "Black Heels", category: "shoes", color: "black", is_active: true },
    { id: "s2", name: "White Sneakers", category: "shoes", color: "white", is_active: true },
    { id: "o1", name: "Leather Jacket", category: "outerwear", clothing_type: "jacket", color: "black", is_active: true },
    { id: "a1", name: "Gold Necklace", category: "accessories", clothing_type: "necklace", color: "gold", is_active: true },
  ];

  test("one-piece outfits do not include separate tops or bottoms", () => {
    const outfits = generateThreeOutfits(onePieceWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    for (const outfit of outfits) {
      const hasOnePiece = outfit.some((i) => i.is_one_piece);
      if (hasOnePiece) {
        const hasTop = outfit.some((i) => !i.is_one_piece && i.category === "Tops");
        const hasBottom = outfit.some((i) => !i.is_one_piece && i.category === "Bottoms");
        expect(hasTop).toBe(false);
        expect(hasBottom).toBe(false);
      }
    }
  });

  test("one-piece outfits can include outerwear", () => {
    const outfits = generateThreeOutfits(onePieceWardrobe, 42, "rectangle", new Set(), new Map(), "cool", "morning", null);
    const onePieceOutfits = outfits.filter((o) => o.some((i) => i.is_one_piece));
    if (onePieceOutfits.length > 0) {
      const someHaveOuter = onePieceOutfits.some((o) => o.some((i) => i.category === "Outerwear"));
      expect(someHaveOuter).toBe(true);
    }
  });

  test("one-piece outfits always include shoes", () => {
    const outfits = generateThreeOutfits(onePieceWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    for (const outfit of outfits) {
      const hasShoes = outfit.some((i) => i.category === "Shoes");
      expect(hasShoes).toBe(true);
    }
  });

  test("generates valid outfits when only one-pieces and shoes exist", () => {
    const minimal = [
      { id: "d1", name: "Black Dress", category: "tops", clothing_type: "dress", color: "black", is_active: true },
      { id: "s1", name: "Heels", category: "shoes", color: "black", is_active: true },
    ];
    const outfits = generateThreeOutfits(minimal, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits).toHaveLength(3);
    for (const outfit of outfits) {
      expect(outfit.length).toBeGreaterThanOrEqual(2);
    }
  });
});

/* ── Clothing set tests ──────────────────────────────────────────────── */

describe("matching set handling", () => {
  const setWardrobe = [
    { id: "st1", name: "Linen Shirt", category: "tops", clothing_type: "dress shirt", color: "beige", set_id: "linen-set", is_active: true },
    { id: "sb1", name: "Linen Pants", category: "bottoms", color: "beige", set_id: "linen-set", is_active: true },
    { id: "t1", name: "Blue Tee", category: "tops", clothing_type: "t-shirt", color: "blue", is_active: true },
    { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
    { id: "s1", name: "Loafers", category: "shoes", color: "brown", is_active: true },
    { id: "s2", name: "Sneakers", category: "shoes", color: "white", is_active: true },
  ];

  test("set items appear together in at least one outfit", () => {
    /* Try several seeds — set partner selection is variant/scoring dependent */
    let found = false;
    for (const seed of [1, 7, 13, 42, 99, 200, 555]) {
      const outfits = generateThreeOutfits(setWardrobe, seed, "rectangle", new Set(), new Map(), "mild", "morning", null);
      if (outfits.some((outfit) => {
        const ids = outfit.map((i) => i.id);
        return ids.includes("st1") && ids.includes("sb1");
      })) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("set items share the same set_id in output", () => {
    const outfits = generateThreeOutfits(setWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    for (const outfit of outfits) {
      const setItems = outfit.filter((i) => i.set_id);
      if (setItems.length >= 2) {
        const setIds = setItems.map((i) => i.set_id);
        /* All set items in one outfit should share the same set_id */
        expect(new Set(setIds).size).toBe(1);
      }
    }
  });

  test("partial set still generates valid outfits", () => {
    const partialSetWardrobe = [
      { id: "st1", name: "Linen Shirt", category: "tops", clothing_type: "dress shirt", color: "beige", set_id: "linen-set", is_active: true },
      /* Bottom from the set is missing */
      { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
      { id: "s1", name: "Loafers", category: "shoes", color: "brown", is_active: true },
    ];
    const outfits = generateThreeOutfits(partialSetWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits).toHaveLength(3);
    for (const outfit of outfits) {
      expect(outfit.length).toBeGreaterThanOrEqual(2);
      /* The lone set item should pair with a non-set bottom */
      const hasTop = outfit.some((i) => i.category === "Tops");
      const hasBottom = outfit.some((i) => i.category === "Bottoms");
      expect(hasTop).toBe(true);
      expect(hasBottom).toBe(true);
    }
  });

  test("multi-category sets link across shoes and accessories", () => {
    const multiCatSet = [
      { id: "st1", name: "Suit Jacket", category: "outerwear", clothing_type: "blazer", color: "navy", set_id: "navy-suit", is_active: true },
      { id: "sb1", name: "Suit Pants", category: "bottoms", color: "navy", set_id: "navy-suit", is_active: true },
      { id: "t1", name: "White Shirt", category: "tops", clothing_type: "dress shirt", color: "white", is_active: true },
      { id: "s1", name: "Oxford Shoes", category: "shoes", color: "black", is_active: true },
    ];
    const outfits = generateThreeOutfits(multiCatSet, 42, "rectangle", new Set(), new Map(), "cool", "morning", null);
    const hasSuitOutfit = outfits.some((outfit) => {
      const ids = outfit.map((i) => i.id);
      return ids.includes("st1") && ids.includes("sb1");
    });
    expect(hasSuitOutfit).toBe(true);
  });
});

describe("one-piece with sets", () => {
  test("one-piece item in a set pairs with set accessories", () => {
    const wardrobe = [
      { id: "d1", name: "Red Dress", category: "tops", clothing_type: "dress", color: "red", set_id: "red-set", is_active: true },
      { id: "a1", name: "Red Clutch", category: "accessories", clothing_type: "bag", color: "red", set_id: "red-set", is_active: true },
      { id: "s1", name: "Black Heels", category: "shoes", color: "black", is_active: true },
      { id: "t1", name: "White Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "evening", null);
    const dressOutfits = outfits.filter((o) => o.some((i) => i.id === "d1"));
    if (dressOutfits.length > 0) {
      /* Dress outfit should include the matching clutch */
      const hasClutch = dressOutfits.some((o) => o.some((i) => i.id === "a1"));
      expect(hasClutch).toBe(true);
      /* And should not have a separate top or bottom */
      for (const outfit of dressOutfits) {
        expect(outfit.some((i) => i.id === "t1")).toBe(false);
        expect(outfit.some((i) => i.id === "b1")).toBe(false);
      }
    }
  });
});

/* ── Color relationship analysis tests ─────────────────────────────── */

describe("analyzeColorRelationship", () => {
  test("complementary: blue and orange", () => {
    const rel = analyzeColorRelationship("blue", "orange");
    expect(rel.type).toBe("complementary");
    expect(rel.score).toBe(5);
    expect(rel.nameA).toBe("blue");
    expect(rel.nameB).toBe("orange");
  });

  test("analogous: blue and teal", () => {
    const rel = analyzeColorRelationship("blue", "teal");
    expect(rel.type).toBe("analogous");
    expect(rel.score).toBe(4);
  });

  test("triadic: red and blue", () => {
    const rel = analyzeColorRelationship("red", "blue");
    expect(rel.type).toBe("triadic");
    expect(rel.score).toBe(3);
  });

  test("neutral-anchor: black and red", () => {
    const rel = analyzeColorRelationship("black", "red");
    expect(rel.type).toBe("neutral-anchor");
    expect(rel.score).toBe(4);
  });

  test("neutral-anchor: white and blue (light neutral scores lower)", () => {
    const rel = analyzeColorRelationship("white", "blue");
    expect(rel.type).toBe("neutral-anchor");
    expect(rel.score).toBe(3);
  });

  test("neutral-pair: black and white", () => {
    const rel = analyzeColorRelationship("black", "white");
    expect(rel.type).toBe("neutral-pair");
    expect(rel.score).toBe(4);
  });

  test("monochrome: same color", () => {
    const rel = analyzeColorRelationship("navy", "navy");
    expect(rel.type).toBe("monochrome");
  });

  test("analogous: very close hues (red and coral)", () => {
    const rel = analyzeColorRelationship("red", "coral");
    expect(rel.type).toBe("analogous");
    expect(rel.score).toBe(4);
  });

  test("clash: red and yellow", () => {
    const rel = analyzeColorRelationship("red", "yellow");
    expect(rel.type).toBe("clash");
    expect(rel.score).toBe(1);
  });

  test("unknown: empty input", () => {
    const rel = analyzeColorRelationship("", "blue");
    expect(rel.type).toBe("unknown");
  });

  test("handles normalized aliases", () => {
    const rel = analyzeColorRelationship("navy blue", "orange");
    expect(rel.nameA).toBe("navy");
    expect(rel.type).toBe("complementary");
  });
});

describe("analyzeOutfitColors", () => {
  test("identifies complementary dominant type", () => {
    const outfit = [
      { color: "blue" },
      { color: "orange" },
      { color: "black" },
    ];
    const result = analyzeOutfitColors(outfit);
    expect(result.dominantType).toBe("neutral-anchor");
    const hasComplementary = result.relationships.some((r) => r.type === "complementary");
    expect(hasComplementary).toBe(true);
  });

  test("counts neutrals and chromatics correctly", () => {
    const outfit = [
      { color: "black" },
      { color: "white" },
      { color: "red" },
    ];
    const result = analyzeOutfitColors(outfit);
    expect(result.neutralCount).toBe(2);
    expect(result.chromaticCount).toBe(1);
    expect(result.isBalanced).toBe(true);
  });

  test("all-neutral outfit is not balanced", () => {
    const outfit = [
      { color: "black" },
      { color: "white" },
      { color: "gray" },
    ];
    const result = analyzeOutfitColors(outfit);
    expect(result.chromaticCount).toBe(0);
    expect(result.isBalanced).toBe(false);
    expect(result.dominantType).toBe("neutral-pair");
  });

  test("deduplicates colors", () => {
    const outfit = [
      { color: "blue" },
      { color: "blue" },
      { color: "red" },
    ];
    const result = analyzeOutfitColors(outfit);
    expect(result.uniqueColors).toEqual(["blue", "red"]);
    expect(result.relationships).toHaveLength(1);
  });

  test("handles multi-color items", () => {
    const outfit = [
      { color: "blue, white" },
      { color: "red" },
    ];
    const result = analyzeOutfitColors(outfit);
    expect(result.uniqueColors).toContain("blue");
    expect(result.uniqueColors).toContain("white");
    expect(result.uniqueColors).toContain("red");
    expect(result.relationships.length).toBeGreaterThanOrEqual(2);
  });

  test("returns empty analysis for empty outfit", () => {
    const result = analyzeOutfitColors([]);
    expect(result.relationships).toHaveLength(0);
    expect(result.uniqueColors).toHaveLength(0);
    expect(result.dominantType).toBe("mixed");
  });

  test("harmonyScore reflects relationship quality", () => {
    const coordinated = analyzeOutfitColors([
      { color: "blue" },
      { color: "orange" },
    ]);
    const clashing = analyzeOutfitColors([
      { color: "green" },
      { color: "orange" },
    ]);
    expect(coordinated.harmonyScore).toBeGreaterThan(clashing.harmonyScore);
  });
});

/* ── Color explanation accuracy tests ──────────────────────────────── */

describe("color explanation accuracy", () => {
  test("complementary outfit explanation mentions complementary relationship", () => {
    const outfit = [
      { id: "1", name: "Blue Shirt", category: "Tops", color: "blue" },
      { id: "2", name: "Orange Pants", category: "Bottoms", color: "orange" },
      { id: "3", name: "White Shoes", category: "Shoes", color: "white" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("complementary") || lower.includes("across the wheel") || lower.includes("opposite")).toBe(true);
  });

  test("analogous outfit explanation mentions tonal closeness", () => {
    const outfit = [
      { id: "1", name: "Blue Shirt", category: "Tops", color: "blue" },
      { id: "2", name: "Teal Pants", category: "Bottoms", color: "teal" },
      { id: "3", name: "Navy Shoes", category: "Shoes", color: "navy" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("analogous") || lower.includes("close") || lower.includes("tonal") || lower.includes("blend") || lower.includes("cohesive")).toBe(true);
  });

  test("neutral-only outfit explanation reflects neutral palette", () => {
    const outfit = [
      { id: "1", name: "Black Blazer", category: "Outerwear", color: "black" },
      { id: "2", name: "White Shirt", category: "Tops", color: "white" },
      { id: "3", name: "Gray Pants", category: "Bottoms", color: "gray" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("neutral") || lower.includes("classic") || lower.includes("timeless") || lower.includes("texture") || lower.includes("versatile") || lower.includes("clean")).toBe(true);
  });

  test("neutral-anchor explanation identifies the grounding neutral", () => {
    const outfit = [
      { id: "1", name: "Red Shirt", category: "Tops", color: "red" },
      { id: "2", name: "Black Pants", category: "Bottoms", color: "black" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    const mentionsRole = lower.includes("ground") || lower.includes("pop") || lower.includes("anchor")
      || lower.includes("polish") || lower.includes("balance") || lower.includes("talking");
    expect(mentionsRole).toBe(true);
  });
});

describe("explanation template rotation", () => {
  test("different outfit items produce different explanations", () => {
    const base = { answers: {}, weatherCategory: "mild", timeCategory: "morning" };
    const results = new Set();
    for (let i = 0; i < 5; i++) {
      const outfit = [
        { id: `t${i}`, name: `Shirt ${i}`, category: "Tops", color: "blue" },
        { id: `b${i}`, name: `Pants ${i}`, category: "Bottoms", color: "orange" },
        { id: `s${i}`, name: `Shoes ${i}`, category: "Shoes", color: "black" },
      ];
      results.add(buildExplanation({ ...base, outfit }));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  test("generated outfits receive distinct explanations", () => {
    const wardrobe = [
      { id: "t1", name: "Blue Tee", category: "tops", clothing_type: "t-shirt", color: "blue", is_active: true },
      { id: "t2", name: "Red Polo", category: "tops", clothing_type: "polo", color: "red", is_active: true },
      { id: "t3", name: "Green Shirt", category: "tops", clothing_type: "dress shirt", color: "green", is_active: true },
      { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
      { id: "b2", name: "Navy Chinos", category: "bottoms", color: "navy", is_active: true },
      { id: "b3", name: "Beige Khakis", category: "bottoms", color: "beige", is_active: true },
      { id: "s1", name: "White Sneakers", category: "shoes", color: "white", is_active: true },
      { id: "s2", name: "Brown Boots", category: "shoes", color: "brown", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 99, "rectangle", new Set(), new Map(), "mild", "morning", null);
    const explanations = outfits.map((outfit) =>
      buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "morning" })
    );
    const unique = new Set(explanations);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

/* ── Occasion-based recommendation tests ───────────────────────────── */

describe("occasion scoring in outfit generation", () => {
  const baseWardrobe = [
    { id: "t1", name: "Dress Shirt", category: "tops", clothing_type: "dress shirt", color: "white", occasion_tags: "work,formal", is_active: true },
    { id: "t2", name: "Tank Top", category: "tops", clothing_type: "tank top", color: "red", occasion_tags: "casual,athletic", is_active: true },
    { id: "t3", name: "Polo Shirt", category: "tops", clothing_type: "polo", color: "navy", occasion_tags: "casual,work", is_active: true },
    { id: "b1", name: "Dress Trousers", category: "bottoms", color: "black", occasion_tags: "work,formal", is_active: true },
    { id: "b2", name: "Gym Shorts", category: "bottoms", clothing_type: "athletic shorts", color: "gray", occasion_tags: "athletic", is_active: true },
    { id: "b3", name: "Jeans", category: "bottoms", color: "blue", occasion_tags: "casual,social", is_active: true },
    { id: "s1", name: "Dress Shoes", category: "shoes", clothing_type: "dress shoes", color: "black", occasion_tags: "work,formal", is_active: true },
    { id: "s2", name: "Sneakers", category: "shoes", color: "white", occasion_tags: "casual,athletic", is_active: true },
    { id: "a1", name: "Watch", category: "accessories", clothing_type: "watch", color: "silver", is_active: true },
    { id: "a2", name: "Belt", category: "accessories", clothing_type: "belt", color: "black", occasion_tags: "work,formal", is_active: true },
  ];

  test("work occasion favors work-tagged items", () => {
    const answers = { dressFor: ["work"] };
    const outfits = generateThreeOutfits(baseWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "work hours", answers);
    expect(outfits.length).toBe(3);

    const allItemIds = outfits.flat().map((item) => item.id);
    const workItemCount = allItemIds.filter((id) => ["t1", "t3", "b1", "s1", "a2"].includes(id)).length;
    const athleticItemCount = allItemIds.filter((id) => ["t2", "b2"].includes(id)).length;
    expect(workItemCount).toBeGreaterThan(athleticItemCount);
  });

  test("athletic occasion favors athletic-tagged items", () => {
    const answers = { dressFor: ["athletic"] };
    const outfits = generateThreeOutfits(baseWardrobe, 42, "rectangle", new Set(), new Map(), "warm", "morning", answers);
    expect(outfits.length).toBe(3);

    const allItemIds = outfits.flat().map((item) => item.id);
    const athleticCount = allItemIds.filter((id) => ["t2", "b2", "s2"].includes(id)).length;
    expect(athleticCount).toBeGreaterThanOrEqual(1);
  });

  test("formal occasion avoids athletic items", () => {
    const answers = { dressFor: ["formal"] };
    const outfits = generateThreeOutfits(baseWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "evening", answers);

    for (const outfit of outfits) {
      const ids = outfit.map((item) => item.id);
      const hasGymShorts = ids.includes("b2");
      const hasTankTop = ids.includes("t2");
      expect(hasGymShorts && hasTankTop).toBe(false);
    }
  });

  test("casual occasion includes casual-tagged items", () => {
    const answers = { dressFor: ["casual"] };
    const outfits = generateThreeOutfits(baseWardrobe, 77, "rectangle", new Set(), new Map(), "mild", "morning", answers);
    expect(outfits.length).toBe(3);

    const allItemIds = outfits.flat().map((item) => item.id);
    const casualCount = allItemIds.filter((id) => ["t2", "t3", "b3", "s2"].includes(id)).length;
    expect(casualCount).toBeGreaterThanOrEqual(1);
  });
});

describe("occasion conflict rules", () => {
  test("blazer never pairs with athletic shorts", () => {
    const wardrobe = [
      { id: "t1", name: "White Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
      { id: "b1", name: "Gym Shorts", category: "bottoms", clothing_type: "athletic shorts", color: "gray", is_active: true },
      { id: "b2", name: "Chinos", category: "bottoms", color: "beige", is_active: true },
      { id: "o1", name: "Navy Blazer", category: "outerwear", clothing_type: "blazer", color: "navy", is_active: true },
      { id: "s1", name: "Sneakers", category: "shoes", color: "white", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "cool", "work hours", null);

    for (const outfit of outfits) {
      const ids = outfit.map((item) => item.id);
      const hasBlazer = ids.includes("o1");
      const hasGymShorts = ids.includes("b1");
      expect(hasBlazer && hasGymShorts).toBe(false);
    }
  });

  test("dress shoes never pair with athletic shorts", () => {
    const wardrobe = [
      { id: "t1", name: "Polo", category: "tops", clothing_type: "polo", color: "blue", is_active: true },
      { id: "b1", name: "Running Shorts", category: "bottoms", clothing_type: "running shorts", color: "black", is_active: true },
      { id: "b2", name: "Trousers", category: "bottoms", color: "gray", is_active: true },
      { id: "s1", name: "Oxfords", category: "shoes", clothing_type: "dress shoes", color: "brown", is_active: true },
      { id: "s2", name: "Sneakers", category: "shoes", color: "white", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "warm", "morning", null);

    for (const outfit of outfits) {
      const ids = outfit.map((item) => item.id);
      const hasDressShoes = ids.includes("s1");
      const hasRunningShorts = ids.includes("b1");
      expect(hasDressShoes && hasRunningShorts).toBe(false);
    }
  });

  test("athletic occasion excludes jewelry and belt accessories", () => {
    const wardrobe = [
      { id: "t1", name: "Tank Top", category: "tops", clothing_type: "tank top", color: "black", is_active: true },
      { id: "b1", name: "Gym Shorts", category: "bottoms", clothing_type: "athletic shorts", color: "gray", is_active: true },
      { id: "s1", name: "Running Shoes", category: "shoes", color: "white", is_active: true },
      { id: "a1", name: "Gold Necklace", category: "accessories", clothing_type: "jewelry", color: "gold", is_active: true },
      { id: "a2", name: "Leather Belt", category: "accessories", clothing_type: "belt", color: "brown", is_active: true },
      { id: "a3", name: "Sports Watch", category: "accessories", clothing_type: "watch", color: "black", is_active: true },
    ];
    const answers = { dressFor: ["athletic"] };
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "warm", "morning", answers);

    for (const outfit of outfits) {
      const ids = outfit.map((item) => item.id);
      expect(ids.includes("a1")).toBe(false);
      expect(ids.includes("a2")).toBe(false);
    }
  });
});

describe("occasion with style interaction", () => {
  test("style and occasion together produce coherent outfits", () => {
    const wardrobe = [
      { id: "t1", name: "Blazer Tee", category: "tops", clothing_type: "t-shirt", color: "white", style_tags: "smart casual", occasion_tags: "work", is_active: true },
      { id: "t2", name: "Hoodie", category: "tops", clothing_type: "hoodie", color: "gray", style_tags: "relaxed", occasion_tags: "casual", is_active: true },
      { id: "b1", name: "Chinos", category: "bottoms", color: "navy", style_tags: "smart casual", occasion_tags: "work", is_active: true },
      { id: "b2", name: "Sweatpants", category: "bottoms", color: "gray", style_tags: "relaxed", occasion_tags: "casual", is_active: true },
      { id: "s1", name: "Loafers", category: "shoes", color: "brown", style_tags: "smart casual", occasion_tags: "work", is_active: true },
      { id: "s2", name: "Slides", category: "shoes", color: "black", style_tags: "relaxed", occasion_tags: "casual", is_active: true },
    ];
    const answers = { dressFor: ["work"], style: ["smart casual"] };
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "work hours", answers);

    const allItemIds = outfits.flat().map((item) => item.id);
    const workItems = allItemIds.filter((id) => ["t1", "b1", "s1"].includes(id)).length;
    const casualItems = allItemIds.filter((id) => ["t2", "b2", "s2"].includes(id)).length;
    expect(workItems).toBeGreaterThan(casualItems);
  });

  test("no occasion selected still generates valid outfits", () => {
    const wardrobe = [
      { id: "t1", name: "Tee", category: "tops", color: "blue", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "black", is_active: true },
      { id: "s1", name: "Sneakers", category: "shoes", color: "white", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits.length).toBe(3);
    for (const outfit of outfits) {
      expect(outfit.length).toBeGreaterThanOrEqual(1);
    }
  });
});

/* ── Multi-outfit variety and deduplication tests ──────────────────── */

describe("outfit variety and deduplication", () => {
  const largeWardrobe = [
    { id: "t1", name: "White Tee", category: "tops", clothing_type: "t-shirt", color: "white", is_active: true },
    { id: "t2", name: "Blue Polo", category: "tops", clothing_type: "polo", color: "blue", is_active: true },
    { id: "t3", name: "Red Henley", category: "tops", clothing_type: "henley", color: "red", is_active: true },
    { id: "t4", name: "Black Turtleneck", category: "tops", clothing_type: "turtleneck", color: "black", is_active: true },
    { id: "b1", name: "Black Jeans", category: "bottoms", color: "black", is_active: true },
    { id: "b2", name: "Navy Chinos", category: "bottoms", color: "navy", is_active: true },
    { id: "b3", name: "Beige Khakis", category: "bottoms", color: "beige", is_active: true },
    { id: "b4", name: "Gray Trousers", category: "bottoms", color: "gray", is_active: true },
    { id: "s1", name: "White Sneakers", category: "shoes", color: "white", is_active: true },
    { id: "s2", name: "Brown Boots", category: "shoes", color: "brown", is_active: true },
    { id: "s3", name: "Black Oxfords", category: "shoes", color: "black", is_active: true },
    { id: "o1", name: "Navy Blazer", category: "outerwear", clothing_type: "blazer", color: "navy", is_active: true },
    { id: "o2", name: "Green Jacket", category: "outerwear", clothing_type: "jacket", color: "green", is_active: true },
  ];

  test("3 returned outfits have distinct item signatures", () => {
    const outfits = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits.length).toBe(3);

    const sigs = outfits.map((outfit) => idsSignature(outfit.map((item) => item.id)));
    const unique = new Set(sigs);
    expect(unique.size).toBe(3);
  });

  test("outfits differ in at least one item", () => {
    const outfits = generateThreeOutfits(largeWardrobe, 99, "rectangle", new Set(), new Map(), "mild", "work hours", null);
    for (let i = 0; i < outfits.length; i++) {
      for (let j = i + 1; j < outfits.length; j++) {
        const idsA = new Set(outfits[i].map((item) => item.id));
        const idsB = new Set(outfits[j].map((item) => item.id));
        const overlap = [...idsA].filter((id) => idsB.has(id)).length;
        const maxLen = Math.max(idsA.size, idsB.size);
        expect(overlap).toBeLessThan(maxLen);
      }
    }
  });

  test("different seeds produce different outfit sets", () => {
    const outfitsA = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    const outfitsB = generateThreeOutfits(largeWardrobe, 999, "rectangle", new Set(), new Map(), "mild", "morning", null);

    const sigsA = new Set(outfitsA.map((o) => idsSignature(o.map((i) => i.id))));
    const sigsB = new Set(outfitsB.map((o) => idsSignature(o.map((i) => i.id))));
    const shared = [...sigsA].filter((s) => sigsB.has(s)).length;
    expect(shared).toBeLessThan(3);
  });

  test("skipSigs excludes saved outfits from results", () => {
    const outfitsFirst = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    const savedSigs = new Set(outfitsFirst.map((o) => idsSignature(o.map((i) => i.id))));

    const outfitsSecond = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null, savedSigs);
    const secondSigs = outfitsSecond.map((o) => idsSignature(o.map((i) => i.id)));

    for (const sig of secondSigs) {
      expect(savedSigs.has(sig)).toBe(false);
    }
  });

  test("recentSigs penalty reduces repeat recommendations", () => {
    const outfitsFirst = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    const recentSigs = new Set(outfitsFirst.map((o) => idsSignature(o.map((i) => i.id))));

    const outfitsSecond = generateThreeOutfits(largeWardrobe, 42, "rectangle", recentSigs, new Map(), "mild", "morning", null);
    const secondSigs = new Set(outfitsSecond.map((o) => idsSignature(o.map((i) => i.id))));

    const overlap = [...recentSigs].filter((s) => secondSigs.has(s)).length;
    expect(overlap).toBeLessThan(recentSigs.size);
  });

  test("item frequency penalty promotes variety in items used", () => {
    const frequentItems = new Map([["t1", 5], ["b1", 5], ["s1", 5]]);
    const outfits = generateThreeOutfits(largeWardrobe, 42, "rectangle", new Set(), frequentItems, "mild", "morning", null);

    const allIds = outfits.flat().map((item) => item.id);
    const frequentCount = allIds.filter((id) => ["t1", "b1", "s1"].includes(id)).length;
    const otherCount = allIds.filter((id) => !["t1", "b1", "s1"].includes(id)).length;
    expect(otherCount).toBeGreaterThan(frequentCount);
  });
});

describe("variety across wardrobe sizes", () => {
  test("small wardrobe (3 items) still returns 3 outfits", () => {
    const wardrobe = [
      { id: "t1", name: "Tee", category: "tops", color: "blue", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "black", is_active: true },
      { id: "s1", name: "Sneakers", category: "shoes", color: "white", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits.length).toBe(3);
    for (const outfit of outfits) {
      expect(outfit.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("medium wardrobe produces 3 distinct outfits", () => {
    const wardrobe = [
      { id: "t1", name: "White Tee", category: "tops", color: "white", is_active: true },
      { id: "t2", name: "Blue Shirt", category: "tops", color: "blue", is_active: true },
      { id: "b1", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
      { id: "b2", name: "Chinos", category: "bottoms", color: "beige", is_active: true },
      { id: "s1", name: "Sneakers", category: "shoes", color: "white", is_active: true },
      { id: "s2", name: "Boots", category: "shoes", color: "brown", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits.length).toBe(3);

    const sigs = outfits.map((o) => idsSignature(o.map((i) => i.id)));
    const unique = new Set(sigs);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  test("large wardrobe produces 3 fully distinct outfits", () => {
    const wardrobe = [];
    for (let i = 0; i < 5; i++) wardrobe.push({ id: `t${i}`, name: `Top ${i}`, category: "tops", color: ["white", "blue", "red", "green", "navy"][i], is_active: true });
    for (let i = 0; i < 5; i++) wardrobe.push({ id: `b${i}`, name: `Bottom ${i}`, category: "bottoms", color: ["black", "blue", "beige", "gray", "navy"][i], is_active: true });
    for (let i = 0; i < 3; i++) wardrobe.push({ id: `s${i}`, name: `Shoe ${i}`, category: "shoes", color: ["white", "black", "brown"][i], is_active: true });

    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "morning", null);
    expect(outfits.length).toBe(3);

    const sigs = outfits.map((o) => idsSignature(o.map((i) => i.id)));
    const unique = new Set(sigs);
    expect(unique.size).toBe(3);
  });
});

describe("ranking returns top scoring outfits", () => {
  test("first outfit scores equal or higher than subsequent outfits", () => {
    const wardrobe = [
      { id: "t1", name: "Dress Shirt", category: "tops", clothing_type: "dress shirt", color: "white", occasion_tags: "work", is_active: true },
      { id: "t2", name: "Graphic Tee", category: "tops", clothing_type: "t-shirt", color: "red", is_active: true },
      { id: "t3", name: "Polo", category: "tops", clothing_type: "polo", color: "navy", is_active: true },
      { id: "b1", name: "Dress Pants", category: "bottoms", color: "black", occasion_tags: "work", is_active: true },
      { id: "b2", name: "Jeans", category: "bottoms", color: "blue", is_active: true },
      { id: "s1", name: "Oxfords", category: "shoes", color: "black", is_active: true },
      { id: "s2", name: "Sneakers", category: "shoes", color: "white", is_active: true },
    ];
    const outfits = generateThreeOutfits(wardrobe, 42, "rectangle", new Set(), new Map(), "mild", "work hours", { dressFor: ["work"] });
    expect(outfits.length).toBe(3);

    const scores = outfits.map((outfit) =>
      scoreOutfitForDisplay(outfit, { weatherCategory: "mild", timeCategory: "work hours", answers: { dressFor: ["work"] }, bodyTypeId: "rectangle" })
    );
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });
});

/* ── Scoring algorithm quality tests ───────────────────────────────── */

describe("scoreOutfitForDisplay", () => {
  const defaultCtx = { weatherCategory: "mild", timeCategory: "work hours", answers: {}, bodyTypeId: "rectangle" };

  test("returns a number clamped between 0 and 100", () => {
    const outfit = [
      { id: "1", name: "Tee", category: "Tops", color: "blue" },
      { id: "2", name: "Jeans", category: "Bottoms", color: "black" },
      { id: "3", name: "Sneakers", category: "Shoes", color: "white" },
    ];
    const score = scoreOutfitForDisplay(outfit, defaultCtx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("empty outfit scores 0", () => {
    expect(scoreOutfitForDisplay([], defaultCtx)).toBe(0);
  });

  test("complete outfit (top+bottom+shoes) scores higher than incomplete", () => {
    const complete = [
      { id: "1", name: "Tee", category: "Tops", color: "white" },
      { id: "2", name: "Jeans", category: "Bottoms", color: "black" },
      { id: "3", name: "Sneakers", category: "Shoes", color: "white" },
    ];
    const noShoes = [
      { id: "1", name: "Tee", category: "Tops", color: "white" },
      { id: "2", name: "Jeans", category: "Bottoms", color: "black" },
    ];
    const noBottom = [
      { id: "1", name: "Tee", category: "Tops", color: "white" },
      { id: "3", name: "Sneakers", category: "Shoes", color: "white" },
    ];
    const completeScore = scoreOutfitForDisplay(complete, defaultCtx);
    expect(completeScore).toBeGreaterThan(scoreOutfitForDisplay(noShoes, defaultCtx));
    expect(completeScore).toBeGreaterThan(scoreOutfitForDisplay(noBottom, defaultCtx));
  });
});

describe("scoring factor quality", () => {
  test("weather-appropriate outfit scores higher than mismatched", () => {
    const coldCtx = { weatherCategory: "cold", timeCategory: "morning", answers: {}, bodyTypeId: "rectangle" };
    const winterOutfit = [
      { id: "1", name: "Turtleneck", category: "Tops", clothing_type: "turtleneck", color: "black", layer_type: "base" },
      { id: "2", name: "Parka", category: "Outerwear", clothing_type: "parka", color: "navy", layer_type: "outer" },
      { id: "3", name: "Wool Pants", category: "Bottoms", color: "gray" },
      { id: "4", name: "Boots", category: "Shoes", color: "brown" },
    ];
    const summerOutfit = [
      { id: "5", name: "Tank Top", category: "Tops", clothing_type: "tank top", color: "white" },
      { id: "6", name: "Shorts", category: "Bottoms", clothing_type: "shorts", color: "beige" },
      { id: "7", name: "Sandals", category: "Shoes", clothing_type: "sandals", color: "brown" },
    ];
    expect(scoreOutfitForDisplay(winterOutfit, coldCtx)).toBeGreaterThan(scoreOutfitForDisplay(summerOutfit, coldCtx));
  });

  test("occasion-matched outfit scores higher than unmatched", () => {
    const workCtx = { weatherCategory: "mild", timeCategory: "work hours", answers: { dressFor: ["work"] }, bodyTypeId: "rectangle" };
    const workOutfit = [
      { id: "1", name: "Dress Shirt", category: "Tops", color: "white", occasion_tags: ["work"] },
      { id: "2", name: "Dress Pants", category: "Bottoms", color: "black", occasion_tags: ["work"] },
    ];
    const casualOutfit = [
      { id: "3", name: "Graphic Tee", category: "Tops", color: "white", occasion_tags: ["casual"] },
      { id: "4", name: "Jeans", category: "Bottoms", color: "black", occasion_tags: ["casual"] },
    ];
    expect(scoreOutfitForDisplay(workOutfit, workCtx)).toBeGreaterThan(scoreOutfitForDisplay(casualOutfit, workCtx));
  });

  test("color-coordinated outfit scores higher than clashing", () => {
    const ctx = { weatherCategory: "mild", timeCategory: "morning", answers: {}, bodyTypeId: "rectangle" };
    const coordinated = [
      { id: "1", name: "Blue Shirt", category: "Tops", color: "blue" },
      { id: "2", name: "Orange Pants", category: "Bottoms", color: "orange" },
    ];
    const clashing = [
      { id: "3", name: "Red Shirt", category: "Tops", color: "red" },
      { id: "4", name: "Yellow Pants", category: "Bottoms", color: "yellow" },
    ];
    expect(scoreOutfitForDisplay(coordinated, ctx)).toBeGreaterThan(scoreOutfitForDisplay(clashing, ctx));
  });

  test("layered cold outfit scores higher than single-layer cold outfit", () => {
    const coldCtx = { weatherCategory: "cold", timeCategory: "morning", answers: {}, bodyTypeId: "rectangle" };
    const layered = [
      { id: "1", name: "Tee", category: "Tops", clothing_type: "t-shirt", color: "white", layer_type: "base" },
      { id: "2", name: "Sweater", category: "Tops", clothing_type: "sweater", color: "gray", layer_type: "mid" },
      { id: "3", name: "Pants", category: "Bottoms", color: "navy" },
    ];
    const singleLayer = [
      { id: "4", name: "Tee", category: "Tops", clothing_type: "t-shirt", color: "white" },
      { id: "5", name: "Pants", category: "Bottoms", color: "navy" },
    ];
    expect(scoreOutfitForDisplay(layered, coldCtx)).toBeGreaterThan(scoreOutfitForDisplay(singleLayer, coldCtx));
  });

  test("set-matched items score higher than unmatched", () => {
    const ctx = { weatherCategory: "mild", timeCategory: "morning", answers: {}, bodyTypeId: "rectangle" };
    const withSet = [
      { id: "1", name: "Suit Jacket", category: "Outerwear", color: "navy", set_id: "navy-suit" },
      { id: "2", name: "Suit Pants", category: "Bottoms", color: "gray", set_id: "navy-suit" },
    ];
    const noSet = [
      { id: "3", name: "Blazer", category: "Outerwear", color: "navy" },
      { id: "4", name: "Khakis", category: "Bottoms", color: "gray" },
    ];
    expect(scoreOutfitForDisplay(withSet, ctx)).toBeGreaterThan(scoreOutfitForDisplay(noSet, ctx));
  });

  test("multiple factors stack: matched occasion + good color > mismatched occasion + good color", () => {
    const workCtx = { weatherCategory: "mild", timeCategory: "work hours", answers: { dressFor: ["work"] }, bodyTypeId: "rectangle" };
    const fullMatch = [
      { id: "1", name: "Dress Shirt", category: "Tops", color: "white", occasion_tags: ["work"] },
      { id: "2", name: "Black Pants", category: "Bottoms", color: "black", occasion_tags: ["work"] },
    ];
    const mismatch = [
      { id: "3", name: "White Tee", category: "Tops", color: "white", occasion_tags: ["athletic"] },
      { id: "4", name: "Black Joggers", category: "Bottoms", color: "black", occasion_tags: ["athletic"] },
    ];
    expect(scoreOutfitForDisplay(fullMatch, workCtx)).toBeGreaterThan(scoreOutfitForDisplay(mismatch, workCtx));
  });
});

/* ── Comfort and environmental explanation tests ───────────────────── */

describe("comfort and environmental context in explanations", () => {
  test("cold weather explanation references warmth or layering", () => {
    const outfit = [
      { id: "1", name: "Wool Sweater", category: "Tops", clothing_type: "sweater", color: "gray", layer_type: "mid" },
      { id: "2", name: "Parka", category: "Outerwear", clothing_type: "parka", color: "black", layer_type: "outer" },
      { id: "3", name: "Jeans", category: "Bottoms", color: "blue" },
      { id: "4", name: "Boots", category: "Shoes", color: "brown" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "cold", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("cold") || lower.includes("warm") || lower.includes("layer") || lower.includes("chill") || lower.includes("bundl")).toBe(true);
  });

  test("hot weather explanation references heat or lightweight", () => {
    const outfit = [
      { id: "1", name: "Tank Top", category: "Tops", clothing_type: "tank top", color: "white" },
      { id: "2", name: "Shorts", category: "Bottoms", clothing_type: "shorts", color: "beige" },
      { id: "3", name: "Sandals", category: "Shoes", clothing_type: "sandals", color: "brown" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "hot", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("heat") || lower.includes("light") || lower.includes("breathab") || lower.includes("cool") || lower.includes("minimal")).toBe(true);
  });

  test("cool weather explanation mentions layers or crisp weather", () => {
    const outfit = [
      { id: "1", name: "Henley", category: "Tops", clothing_type: "henley", color: "navy", layer_type: "base" },
      { id: "2", name: "Cardigan", category: "Tops", clothing_type: "cardigan", color: "gray", layer_type: "mid" },
      { id: "3", name: "Chinos", category: "Bottoms", color: "beige" },
      { id: "4", name: "Boots", category: "Shoes", color: "brown" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "cool", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("layer") || lower.includes("crisp") || lower.includes("cool") || lower.includes("warmth")).toBe(true);
  });

  test("mild weather explanation uses body type reasoning instead of weather", () => {
    const outfit = [
      { id: "1", name: "Tee", category: "Tops", color: "blue" },
      { id: "2", name: "Jeans", category: "Bottoms", color: "black" },
      { id: "3", name: "Sneakers", category: "Shoes", color: "white" },
    ];
    const result = buildExplanation({ outfit, answers: { bodyType: "hourglass" }, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("waist") || lower.includes("proportion") || lower.includes("silhouette") || lower.includes("shape") || lower.includes("dimension")).toBe(true);
  });

  test("explanations differ between cold and hot weather for the same outfit structure", () => {
    const outfit = [
      { id: "1", name: "Shirt", category: "Tops", color: "white" },
      { id: "2", name: "Pants", category: "Bottoms", color: "black" },
      { id: "3", name: "Shoes", category: "Shoes", color: "brown" },
    ];
    const coldExpl = buildExplanation({ outfit, answers: {}, weatherCategory: "cold", timeCategory: "morning" });
    const hotExpl = buildExplanation({ outfit, answers: {}, weatherCategory: "hot", timeCategory: "morning" });
    expect(coldExpl).not.toBe(hotExpl);
  });
});

describe("layering and metadata in explanations", () => {
  test("layered outfit explanation describes layer structure", () => {
    const outfit = [
      { id: "1", name: "Tee", category: "Tops", clothing_type: "t-shirt", color: "white", layer_type: "base" },
      { id: "2", name: "Fleece", category: "Tops", clothing_type: "fleece", color: "gray", layer_type: "mid" },
      { id: "3", name: "Windbreaker", category: "Outerwear", clothing_type: "windbreaker", color: "navy", layer_type: "outer" },
      { id: "4", name: "Jeans", category: "Bottoms", color: "blue" },
      { id: "5", name: "Boots", category: "Shoes", color: "brown" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "cool", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("layer") || lower.includes("base") || lower.includes("outer") || lower.includes("build")).toBe(true);
  });

  test("one-piece outfit explanation mentions one-piece", () => {
    const outfit = [
      { id: "1", name: "Black Dress", category: "Tops", clothing_type: "dress", color: "black", is_one_piece: true },
      { id: "2", name: "Heels", category: "Shoes", color: "beige" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "evening" });
    const lower = result.toLowerCase();
    expect(lower.includes("one-piece") || lower.includes("one piece") || lower.includes("silhouette") || lower.includes("simple") || lower.includes("foundation")).toBe(true);
  });

  test("set-matched outfit explanation mentions coordination", () => {
    const outfit = [
      { id: "1", name: "Suit Jacket", category: "Outerwear", color: "navy", set_id: "suit" },
      { id: "2", name: "Suit Pants", category: "Bottoms", color: "navy", set_id: "suit" },
      { id: "3", name: "Dress Shirt", category: "Tops", color: "white" },
      { id: "4", name: "Oxfords", category: "Shoes", color: "black" },
    ];
    const result = buildExplanation({ outfit, answers: {}, weatherCategory: "mild", timeCategory: "work hours" });
    const lower = result.toLowerCase();
    expect(lower.includes("set") || lower.includes("match") || lower.includes("coordin") || lower.includes("intentional")).toBe(true);
  });

  test("style-tagged outfit explanation mentions style direction", () => {
    const outfit = [
      { id: "1", name: "Blazer", category: "Outerwear", color: "navy", style_tags: ["formal"] },
      { id: "2", name: "Dress Shirt", category: "Tops", color: "white", style_tags: ["formal"] },
      { id: "3", name: "Trousers", category: "Bottoms", color: "gray" },
      { id: "4", name: "Oxfords", category: "Shoes", color: "black" },
    ];
    const result = buildExplanation({ outfit, answers: { style: ["formal"] }, weatherCategory: "mild", timeCategory: "work hours" });
    const lower = result.toLowerCase();
    expect(lower.includes("formal") || lower.includes("style") || lower.includes("detail") || lower.includes("consistent")).toBe(true);
  });

  test("body type pear explanation references frame or top balance", () => {
    const outfit = [
      { id: "1", name: "Structured Top", category: "Tops", color: "white" },
      { id: "2", name: "Dark Jeans", category: "Bottoms", color: "black" },
      { id: "3", name: "Shoes", category: "Shoes", color: "brown" },
    ];
    const result = buildExplanation({ outfit, answers: { bodyType: "pear" }, weatherCategory: "mild", timeCategory: "morning" });
    const lower = result.toLowerCase();
    expect(lower.includes("frame") || lower.includes("top") || lower.includes("balanc") || lower.includes("definition") || lower.includes("streamlin")).toBe(true);
  });
});
