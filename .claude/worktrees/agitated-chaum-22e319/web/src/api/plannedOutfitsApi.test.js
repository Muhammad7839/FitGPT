import { plannedOutfitsApi } from "./plannedOutfitsApi";

const TEST_USER = { id: "test-user-789" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete global.fetch;
});

describe("plannedOutfitsApi.planOutfit", () => {
  test("guest mode cannot plan outfits", async () => {
    const result = await plannedOutfitsApi.planOutfit({ item_ids: ["shirt-1"] }, null);
    expect(result.created).toBe(false);
    expect(result.message).toMatch(/sign in/i);
  });

  test("plans an outfit and returns created: true", async () => {
    const payload = {
      item_ids: ["shirt-1", "pants-2"],
      planned_date: "2025-07-01",
      occasion: "date night",
    };
    const result = await plannedOutfitsApi.planOutfit(payload, TEST_USER);
    expect(result.created).toBe(true);
    expect(result.planned_outfit).toBeDefined();
    expect(result.planned_outfit.item_ids).toEqual(["pants-2", "shirt-1"]);
    expect(result.planned_outfit.planned_date).toBe("2025-07-01");
    expect(result.planned_outfit.occasion).toBe("date night");
  });

  test("returns created: false for empty items", async () => {
    const result = await plannedOutfitsApi.planOutfit({ item_ids: [] }, TEST_USER);
    expect(result.created).toBe(false);
  });

  test("marks local-only plan creation when authenticated remote sync fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "backend offline" }),
      text: async () => "",
    });

    const result = await plannedOutfitsApi.planOutfit(
      { item_ids: ["shirt-1"], planned_date: "2026-04-20" },
      TEST_USER
    );

    expect(result.created).toBe(true);
    expect(result.localOnly).toBe(true);
    expect(result.syncError).toBe(true);
  });
});

describe("plannedOutfitsApi.listPlanned", () => {
  test("guest mode returns an empty plan list", async () => {
    const result = await plannedOutfitsApi.listPlanned(null);
    expect(result.planned_outfits).toEqual([]);
  });

  test("returns empty list initially", async () => {
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);
    expect(result.planned_outfits).toEqual([]);
  });

  test("returns planned outfits after planning", async () => {
    await plannedOutfitsApi.planOutfit({ item_ids: ["a", "b"] }, TEST_USER);
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);
    expect(result.planned_outfits).toHaveLength(1);
  });

  test("merges server plans with offline local plans instead of overwriting them", async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          outfits: [
            {
              id: 77,
              item_ids: ["server-look"],
              planned_date: "2026-03-24",
              created_at_timestamp: 1774267200,
            },
          ],
        }),
      });

    await plannedOutfitsApi.planOutfit({ item_ids: ["local-look"], planned_date: "2026-03-25" }, TEST_USER);
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);

    expect(result.planned_outfits.map((o) => o.planned_id)).toEqual(
      expect.arrayContaining(["77"])
    );
    expect(result.planned_outfits).toHaveLength(2);
  });
});

describe("plannedOutfitsApi.removePlanned", () => {
  test("removes a planned outfit by id", async () => {
    const { planned_outfit } = await plannedOutfitsApi.planOutfit(
      { item_ids: ["x"] },
      TEST_USER
    );
    await plannedOutfitsApi.removePlanned(planned_outfit.planned_id, TEST_USER);
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);
    expect(result.planned_outfits).toHaveLength(0);
  });

  test("uses the canonical backend planned outfit route and normalizes the response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        outfits: [
          {
            id: 9,
            item_ids: ["shirt-1", "pants-2"],
            planned_date: "2026-04-20",
            occasion: "office",
            created_at_timestamp: 1776672000,
          },
        ],
      }),
    });

    const result = await plannedOutfitsApi.planOutfit(
      {
        item_ids: ["pants-2", "shirt-1"],
        planned_date: "2026-04-20",
        occasion: "office",
      },
      TEST_USER
    );

    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/outfits/planned");
    expect(request.method).toBe("POST");
    expect(result.created).toBe(true);
    expect(result.planned_outfit).toMatchObject({
      planned_id: "9",
      item_ids: ["pants-2", "shirt-1"],
      planned_date: "2026-04-20",
      occasion: "office",
      outfit_signature: "pants-2|shirt-1",
    });
  });

  test("marks local-only plan removal when remote delete fails", async () => {
    localStorage.setItem(
      "fitgpt_planned_outfits_v1_test-user-789",
      JSON.stringify([
        {
          planned_id: "9",
          item_ids: ["shirt-1"],
          planned_date: "2026-04-20",
          outfit_signature: "shirt-1",
        },
      ])
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "delete failed" }),
      text: async () => "",
    });

    const result = await plannedOutfitsApi.removePlanned("9", TEST_USER);

    expect(result).toMatchObject({
      deleted: true,
      localOnly: true,
      syncError: true,
    });
  });
});
