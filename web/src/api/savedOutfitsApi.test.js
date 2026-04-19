/**
 * Tests for savedOutfitsApi — local storage fallback path.
 * Uses jsdom's localStorage (provided by Jest).
 */
import { savedOutfitsApi } from "./savedOutfitsApi";

const TEST_USER = { id: "test-user-123" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete global.fetch;
});

describe("savedOutfitsApi.saveOutfit", () => {
  test("guest mode cannot save outfits", async () => {
    const result = await savedOutfitsApi.saveOutfit({ items: ["a", "b"] }, null);
    expect(result.created).toBe(false);
    expect(result.message).toMatch(/sign in/i);
  });

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

  test("marks local-only save when authenticated remote sync fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "backend offline" }),
      text: async () => "",
    });

    const result = await savedOutfitsApi.saveOutfit({ items: ["shirt-1", "pants-2"] }, TEST_USER);

    expect(result.created).toBe(true);
    expect(result.localOnly).toBe(true);
    expect(result.syncError).toBe(true);
  });
});

describe("savedOutfitsApi.listSaved", () => {
  test("guest mode returns an empty list", async () => {
    const result = await savedOutfitsApi.listSaved(null);
    expect(result.saved_outfits).toEqual([]);
  });

  test("returns empty list initially", async () => {
    const result = await savedOutfitsApi.listSaved(TEST_USER);
    expect(result.saved_outfits).toEqual([]);
  });

  test("returns saved outfits after saving", async () => {
    await savedOutfitsApi.saveOutfit({ items: ["x", "y"] }, TEST_USER);
    const result = await savedOutfitsApi.listSaved(TEST_USER);
    expect(result.saved_outfits).toHaveLength(1);
  });

  test("merges server data with offline local outfits instead of overwriting them", async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          saved_outfits: [
            {
              saved_outfit_id: "42",
              items: ["server-top", "server-bottom"],
              outfit_signature: "server-bottom|server-top",
              created_at: "2026-03-23T12:00:00.000Z",
            },
          ],
        }),
      });

    await savedOutfitsApi.saveOutfit({ items: ["local-top", "local-bottom"] }, TEST_USER);
    const result = await savedOutfitsApi.listSaved(TEST_USER);

    expect(result.saved_outfits.map((o) => o.outfit_signature).sort()).toEqual([
      "local-bottom|local-top",
      "server-bottom|server-top",
    ]);
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

  test("marks local-only unsave when remote delete fails", async () => {
    await savedOutfitsApi.saveOutfit({ items: ["a", "b"] }, TEST_USER);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "delete failed" }),
      text: async () => "",
    });

    const result = await savedOutfitsApi.unsaveOutfit("a|b", TEST_USER);

    expect(result).toMatchObject({
      deleted: true,
      localOnly: true,
      syncError: true,
    });
  });
});
