import { plannedOutfitsApi } from "./plannedOutfitsApi";

const TEST_USER = { id: "test-user-789" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("plannedOutfitsApi.planOutfit", () => {
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
});

describe("plannedOutfitsApi.listPlanned", () => {
  test("returns empty list initially", async () => {
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);
    expect(result.planned_outfits).toEqual([]);
  });

  test("returns planned outfits after planning", async () => {
    await plannedOutfitsApi.planOutfit({ item_ids: ["a", "b"] }, TEST_USER);
    const result = await plannedOutfitsApi.listPlanned(TEST_USER);
    expect(result.planned_outfits).toHaveLength(1);
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
});
