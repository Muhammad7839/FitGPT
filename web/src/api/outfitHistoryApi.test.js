/**
 * Tests for outfitHistoryApi — local storage fallback path.
 */
import { outfitHistoryApi } from "./outfitHistoryApi";

const TEST_USER = { id: "test-user-456" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("outfitHistoryApi.recordWorn", () => {
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
});

describe("outfitHistoryApi.listHistory", () => {
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
});
