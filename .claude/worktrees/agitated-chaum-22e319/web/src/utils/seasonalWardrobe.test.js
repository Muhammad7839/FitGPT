import {
  getCurrentSeason,
  getSeasonLabel,
  getSeasonalWardrobeLabel,
  getSeasonMatch,
  hasSeasonalMetadata,
  sortItemsBySeasonalRelevance,
  summarizeSeasonalCollection,
} from "./seasonalWardrobe";

describe("seasonalWardrobe", () => {
  test("maps dates to the expected season", () => {
    expect(getCurrentSeason(new Date("2026-01-05T12:00:00Z"))).toBe("winter");
    expect(getCurrentSeason(new Date("2026-04-05T12:00:00Z"))).toBe("spring");
    expect(getCurrentSeason(new Date("2026-07-05T12:00:00Z"))).toBe("summer");
    expect(getCurrentSeason(new Date("2026-10-05T12:00:00Z"))).toBe("fall");
  });

  test("builds readable season labels", () => {
    expect(getSeasonLabel("spring")).toBe("Spring");
    expect(getSeasonalWardrobeLabel("fall")).toBe("Fall Wardrobe");
  });

  test("recognizes in-season, overlap, and out-of-season items", () => {
    expect(getSeasonMatch({ season_tags: ["spring"] }, "spring").status).toBe("in-season");
    expect(getSeasonMatch({ season_tags: ["winter"] }, "spring").status).toBe("season-overlap");
    expect(getSeasonMatch({ season_tags: ["summer"] }, "winter").status).toBe("out-of-season");
    expect(getSeasonMatch({ season_tags: ["all-season"] }, "summer").status).toBe("all-season");
    expect(getSeasonMatch({ season_tags: [] }, "fall").status).toBe("untagged");
  });

  test("detects whether a wardrobe has seasonal metadata", () => {
    expect(hasSeasonalMetadata([{ season_tags: ["winter"] }])).toBe(true);
    expect(hasSeasonalMetadata([{ season_tags: [] }, {}])).toBe(false);
  });

  test("sorts in-season items before out-of-season ones", () => {
    const sorted = sortItemsBySeasonalRelevance([
      { id: "1", name: "Coat", season_tags: ["winter"] },
      { id: "2", name: "Tee", season_tags: ["spring"] },
      { id: "3", name: "Watch", season_tags: ["all-season"] },
    ], "spring");

    expect(sorted.map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  test("summarizes seasonal status counts", () => {
    const summary = summarizeSeasonalCollection([
      { season_tags: ["spring"] },
      { season_tags: ["all-season"] },
      { season_tags: ["winter"] },
      { season_tags: [] },
    ], "spring");

    expect(summary).toEqual(expect.objectContaining({
      inSeasonCount: 1,
      allSeasonCount: 1,
      overlapCount: 1,
      untaggedCount: 1,
      hasSeasonalMetadata: true,
    }));
  });
});
