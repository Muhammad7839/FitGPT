import { safeParse, makeId, formatToday, normalizeFitTag, normalizeItems, idsSignature, formatCardDate, formatPlanDate, buildWardrobeMap, labelFromSource, setReuseOutfit, monthKey, getProfilePicUploadIssue, PROFILE_GIF_MAX_BYTES, PROFILE_PIC_MAX_BYTES } from "./helpers";
import { REUSE_OUTFIT_KEY } from "./constants";

describe("safeParse", () => {
  test("parses valid JSON", () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
    expect(safeParse("[1,2,3]")).toEqual([1, 2, 3]);
    expect(safeParse('"hello"')).toBe("hello");
  });

  test("returns null for invalid JSON", () => {
    expect(safeParse("not json")).toBeNull();
    expect(safeParse("")).toBeNull();
    expect(safeParse(undefined)).toBeNull();
  });
});

describe("makeId", () => {
  test("returns a non-empty string", () => {
    const id = makeId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(8);
  });

  test("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => makeId()));
    expect(ids.size).toBe(100);
  });
});

describe("formatToday", () => {
  test("returns a non-empty string", () => {
    const result = formatToday();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
  });
});

describe("normalizeFitTag", () => {
  test("returns valid fit tags unchanged", () => {
    expect(normalizeFitTag("slim")).toBe("slim");
    expect(normalizeFitTag("regular")).toBe("regular");
    expect(normalizeFitTag("relaxed")).toBe("relaxed");
    expect(normalizeFitTag("oversized")).toBe("oversized");
  });

  test("normalizes case", () => {
    expect(normalizeFitTag("SLIM")).toBe("slim");
    expect(normalizeFitTag("Regular")).toBe("regular");
  });

  test("trims whitespace", () => {
    expect(normalizeFitTag("  slim  ")).toBe("slim");
  });

  test("returns unknown for invalid tags", () => {
    expect(normalizeFitTag("baggy")).toBe("unknown");
    expect(normalizeFitTag("tight")).toBe("unknown");
    expect(normalizeFitTag("")).toBe("unknown");
    expect(normalizeFitTag(null)).toBe("unknown");
    expect(normalizeFitTag(undefined)).toBe("unknown");
  });
});

describe("getProfilePicUploadIssue", () => {
  test("allows regular images up to 10MB", () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: PROFILE_PIC_MAX_BYTES, configurable: true });
    expect(getProfilePicUploadIssue(file)).toBe("");
  });

  test("rejects oversized regular images", () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: PROFILE_PIC_MAX_BYTES + 1, configurable: true });
    expect(getProfilePicUploadIssue(file)).toBe("This profile photo is too large. Please upload one under 10MB.");
  });

  test("rejects oversized GIFs with the stricter limit", () => {
    const file = new File(["avatar"], "avatar.gif", { type: "image/gif" });
    Object.defineProperty(file, "size", { value: PROFILE_GIF_MAX_BYTES + 1, configurable: true });
    expect(getProfilePicUploadIssue(file)).toBe("This GIF is too large. Please upload one under 3MB.");
  });

  test("rejects non-image files", () => {
    const file = new File(["avatar"], "avatar.txt", { type: "text/plain" });
    expect(getProfilePicUploadIssue(file)).toBe("Please choose an image file.");
  });
});

describe("normalizeItems", () => {
  test("sorts and trims items", () => {
    expect(normalizeItems(["  b ", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  test("filters out empty and null items", () => {
    expect(normalizeItems(["a", "", null, undefined, "b"])).toEqual(["a", "b"]);
  });

  test("converts numbers to strings", () => {
    expect(normalizeItems([3, 1, 2])).toEqual(["1", "2", "3"]);
  });

  test("handles non-array input", () => {
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems(undefined)).toEqual([]);
    expect(normalizeItems("not array")).toEqual([]);
  });
});

describe("idsSignature", () => {
  test("joins normalized items with pipe", () => {
    expect(idsSignature(["b", "a", "c"])).toBe("a|b|c");
  });

  test("returns empty string for empty array", () => {
    expect(idsSignature([])).toBe("");
  });

  test("filters and sorts", () => {
    expect(idsSignature(["z", "", null, "a"])).toBe("a|z");
  });
});

describe("formatCardDate", () => {
  test("formats a valid ISO date", () => {
    const result = formatCardDate("2025-06-15T12:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns empty string for invalid date", () => {
    expect(formatCardDate("not-a-date")).toBe("");
  });
});

describe("buildWardrobeMap", () => {
  test("builds map from wardrobe array", () => {
    const wardrobe = [
      { id: "abc", name: "Shirt" },
      { id: "def", name: "Pants" },
    ];
    const map = buildWardrobeMap(wardrobe);
    expect(map.size).toBe(2);
    expect(map.get("abc").name).toBe("Shirt");
    expect(map.get("def").name).toBe("Pants");
  });

  test("skips items without id", () => {
    const wardrobe = [{ id: "a", name: "A" }, { name: "B" }, { id: "", name: "C" }];
    const map = buildWardrobeMap(wardrobe);
    expect(map.size).toBe(1);
  });

  test("first item wins on duplicate id", () => {
    const wardrobe = [
      { id: "x", name: "First" },
      { id: "x", name: "Second" },
    ];
    const map = buildWardrobeMap(wardrobe);
    expect(map.get("x").name).toBe("First");
  });

  test("handles non-array input", () => {
    expect(buildWardrobeMap(null).size).toBe(0);
    expect(buildWardrobeMap(undefined).size).toBe(0);
  });
});

describe("formatPlanDate", () => {
  test("formats a date-only ISO string with weekday", () => {
    const result = formatPlanDate("2025-06-15");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns original string for invalid date", () => {
    expect(formatPlanDate("not-a-date")).toBe("not-a-date");
  });

  test("returns empty string for falsy input", () => {
    expect(formatPlanDate("")).toBe("");
  });
});

describe("labelFromSource", () => {
  test("maps planner to Planned", () => {
    expect(labelFromSource("planner")).toBe("Planned");
  });

  test("maps recommended to Recommended", () => {
    expect(labelFromSource("recommended")).toBe("Recommended");
  });

  test("defaults to Saved for unknown sources", () => {
    expect(labelFromSource("manual")).toBe("Saved");
    expect(labelFromSource("")).toBe("Saved");
    expect(labelFromSource(null)).toBe("Saved");
  });

  test("is case-insensitive", () => {
    expect(labelFromSource("PLANNER")).toBe("Planned");
    expect(labelFromSource("Recommended")).toBe("Recommended");
  });
});

describe("monthKey", () => {
  test("returns YYYY-MM from ISO string", () => {
    expect(monthKey("2025-06-15T12:00:00Z")).toBe("2025-06");
  });

  test("accepts Date object", () => {
    expect(monthKey(new Date(2025, 0, 1))).toBe("2025-01");
  });

  test("returns empty string for invalid input", () => {
    expect(monthKey("not-a-date")).toBe("");
    expect(monthKey(null)).toBe("");
    expect(monthKey(undefined)).toBe("");
  });
});

describe("setReuseOutfit", () => {
  beforeEach(() => sessionStorage.clear());

  test("stores normalized items in sessionStorage", () => {
    setReuseOutfit(["b", "a"], "outfit-123");
    const stored = JSON.parse(sessionStorage.getItem(REUSE_OUTFIT_KEY));
    expect(stored.items).toEqual(["a", "b"]);
    expect(stored.saved_outfit_id).toBe("outfit-123");
  });

  test("does nothing for empty items", () => {
    setReuseOutfit([], "id");
    expect(sessionStorage.getItem(REUSE_OUTFIT_KEY)).toBeNull();
  });
});
