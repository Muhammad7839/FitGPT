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
