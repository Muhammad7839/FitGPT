/**
 * Tests for savedOutfitsApi — local storage fallback path.
 * Uses jsdom's localStorage (provided by Jest).
 */
import { savedOutfitsApi } from "./savedOutfitsApi";

const TEST_USER = { id: "test-user-123" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("savedOutfitsApi.saveOutfit", () => {
  test("saves an outfit and returns created: true", async () => {
    const payload = {
      items: ["shirt-1", "pants-2", "shoes-3"],
      source: "recommended",
    };
    const result = await savedOutfitsApi.saveOutfit(payload, TEST_USER);
    expect(result.created).toBe(true);
    expect(result.saved_outfit).toBeDefined();
    expect(result.saved_outfit.items).toEqual(["pants-2", "shirt-1", "shoes-3"]); // sorted
    expect(result.saved_outfit.outfit_signature).toBe("pants-2|shirt-1|shoes-3");
  });

  test("prevents duplicate outfit saves", async () => {
    const payload = { items: ["a", "b"] };
    await savedOutfitsApi.saveOutfit(payload, TEST_USER);
    const dup = await savedOutfitsApi.saveOutfit(payload, TEST_USER);
    expect(dup.created).toBe(false);
    expect(dup.message).toMatch(/already/i);
  });

  test("returns created: false for empty items", async () => {
    const result = await savedOutfitsApi.saveOutfit({ items: [] }, TEST_USER);
    expect(result.created).toBe(false);
  });
});

describe("savedOutfitsApi.listSaved", () => {
  test("returns empty list initially", async () => {
    const result = await savedOutfitsApi.listSaved(TEST_USER);
    expect(result.saved_outfits).toEqual([]);
  });

  test("returns saved outfits after saving", async () => {
    await savedOutfitsApi.saveOutfit({ items: ["x", "y"] }, TEST_USER);
    const result = await savedOutfitsApi.listSaved(TEST_USER);
    expect(result.saved_outfits).toHaveLength(1);
  });
});

describe("savedOutfitsApi.unsaveOutfit", () => {
  test("removes outfit by signature", async () => {
    await savedOutfitsApi.saveOutfit({ items: ["a", "b"] }, TEST_USER);
    await savedOutfitsApi.unsaveOutfit("a|b", TEST_USER);
    const result = await savedOutfitsApi.listSaved(TEST_USER);
    expect(result.saved_outfits).toHaveLength(0);
  });

  test("no-op for non-existent signature", async () => {
    const result = await savedOutfitsApi.unsaveOutfit("nonexistent", TEST_USER);
    expect(result.deleted).toBe(true);
  });
});
