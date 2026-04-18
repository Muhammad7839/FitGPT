/**
 * Tests for outfitHistoryApi — local storage fallback path.
 */
import { outfitHistoryApi } from "./outfitHistoryApi";

const TEST_USER = { id: "test-user-456" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete global.fetch;
});

describe("outfitHistoryApi.recordWorn", () => {
  test("guest mode cannot create history entries", async () => {
    const result = await outfitHistoryApi.recordWorn({ item_ids: ["shirt-1"] }, null);
    expect(result.created).toBe(false);
    expect(result.message).toMatch(/sign in/i);
  });

  test("records an outfit and returns created: true", async () => {
    const payload = {
      item_ids: ["shirt-1", "pants-2"],
      source: "recommendation",
    };
    const result = await outfitHistoryApi.recordWorn(payload, TEST_USER);
    expect(result.created).toBe(true);
    expect(result.history_entry).toBeDefined();
    expect(result.history_entry.item_ids).toEqual(["pants-2", "shirt-1"]); // sorted
    expect(result.history_entry.worn_at).toBeTruthy();
  });

  test("returns created: false for empty items", async () => {
    const result = await outfitHistoryApi.recordWorn({ item_ids: [] }, TEST_USER);
    expect(result.created).toBe(false);
  });

  test("marks local-only history updates when authenticated remote sync fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "backend offline" }),
      text: async () => "",
    });

    const result = await outfitHistoryApi.recordWorn({ item_ids: ["shirt-1"] }, TEST_USER);

    expect(result.created).toBe(true);
    expect(result.localOnly).toBe(true);
    expect(result.syncError).toBe("backend offline");
  });
});

describe("outfitHistoryApi.listHistory", () => {
  test("guest mode returns an empty history list", async () => {
    const result = await outfitHistoryApi.listHistory(null);
    expect(result.history).toEqual([]);
  });

  test("returns empty list initially", async () => {
    const result = await outfitHistoryApi.listHistory(TEST_USER);
    expect(result.history).toEqual([]);
  });

  test("returns entries in reverse chronological order", async () => {
    await outfitHistoryApi.recordWorn({ item_ids: ["a"] }, TEST_USER);
    await outfitHistoryApi.recordWorn({ item_ids: ["b"] }, TEST_USER);
    const result = await outfitHistoryApi.listHistory(TEST_USER);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].item_ids).toEqual(["b"]);
    expect(result.history[1].item_ids).toEqual(["a"]);
  });

  test("merges server history with offline local history instead of overwriting it", async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          history: [
            {
              history_id: "88",
              item_ids: ["server-look"],
              worn_at: "2026-03-23T12:00:00.000Z",
            },
          ],
        }),
      });

    await outfitHistoryApi.recordWorn({ item_ids: ["local-look"] }, TEST_USER);
    const result = await outfitHistoryApi.listHistory(TEST_USER);

    expect(result.history.map((h) => h.item_ids.join("|")).sort()).toEqual([
      "local-look",
      "server-look",
    ]);
  });
});

describe("outfitHistoryApi.removeBySignature", () => {
  test("removes entries matching signature", async () => {
    await outfitHistoryApi.recordWorn({ item_ids: ["a", "b"] }, TEST_USER);
    await outfitHistoryApi.recordWorn({ item_ids: ["c", "d"] }, TEST_USER);
    await outfitHistoryApi.removeBySignature("a|b", TEST_USER);
    const result = await outfitHistoryApi.listHistory(TEST_USER);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].item_ids).toEqual(["c", "d"]);
  });
});

describe("outfitHistoryApi.clearHistory", () => {
  test("clears all history", async () => {
    await outfitHistoryApi.recordWorn({ item_ids: ["a"] }, TEST_USER);
    await outfitHistoryApi.recordWorn({ item_ids: ["b"] }, TEST_USER);
    await outfitHistoryApi.clearHistory(TEST_USER);
    const result = await outfitHistoryApi.listHistory(TEST_USER);
    expect(result.history).toEqual([]);
  });

  test("marks local-only clear when remote delete fails", async () => {
    await outfitHistoryApi.recordWorn({ item_ids: ["a"] }, TEST_USER);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "clear failed" }),
      text: async () => "",
    });

    const result = await outfitHistoryApi.clearHistory(TEST_USER);

    expect(result).toMatchObject({
      cleared: true,
      localOnly: true,
      syncError: "clear failed",
    });
  });
});
