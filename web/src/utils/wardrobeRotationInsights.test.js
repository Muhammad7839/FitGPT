import { analyzeWardrobeRotation, ROTATION_DISMISS_DAYS } from "./wardrobeRotationInsights";

describe("analyzeWardrobeRotation", () => {
  const now = new Date("2026-04-03T12:00:00Z").getTime();

  test("surfaces neglected items and attaches outfit suggestions", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops", color: "blue", image_url: "shirt.jpg" },
      { id: "pants-1", name: "Black Trousers", category: "bottoms", color: "black" },
      { id: "shoe-1", name: "White Sneakers", category: "shoes", color: "white" },
    ];

    const history = [
      {
        history_id: "h1",
        item_ids: ["pants-1", "shoe-1"],
        worn_at: "2026-03-01T10:00:00Z",
      },
    ];

    const outfits = [
      [{ id: "shirt-1", name: "Blue Oxford" }, { id: "pants-1", name: "Black Trousers" }],
      [{ id: "pants-1", name: "Black Trousers" }, { id: "shoe-1", name: "White Sneakers" }],
    ];

    const result = analyzeWardrobeRotation({ wardrobe, history, outfits, now });

    expect(result.state).toBe("alert");
    expect(result.items[0].id).toBe("shirt-1");
    expect(result.items[0].trigger).toBe("never");
    expect(result.items[0].suggestions[0].index).toBe(0);
    expect(result.items[0].suggestions[0].optionLabel).toBe("Option 01");
  });

  test("uses frequency and time together to classify underused items", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
      { id: "pants-1", name: "Black Trousers", category: "bottoms" },
      { id: "shoe-1", name: "White Sneakers", category: "shoes" },
    ];

    const history = [
      { history_id: "h1", item_ids: ["shirt-1", "pants-1"], worn_at: "2026-03-20T10:00:00Z" },
      { history_id: "h2", item_ids: ["shirt-1", "pants-1"], worn_at: "2026-03-18T10:00:00Z" },
      { history_id: "h3", item_ids: ["shirt-1", "pants-1"], worn_at: "2026-03-14T10:00:00Z" },
      { history_id: "h4", item_ids: ["shoe-1"], worn_at: "2026-03-15T10:00:00Z" },
    ];

    const result = analyzeWardrobeRotation({ wardrobe, history, outfits: [], now });
    const shoe = result.items.find((item) => item.id === "shoe-1");

    expect(result.state).toBe("alert");
    expect(shoe.trigger).toBe("frequency");
    expect(shoe.triggerLabel).toMatch(/Low wear frequency/i);
  });

  test("filters out recently dismissed alerts", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
    ];

    const dismissedAlerts = {
      "shirt-1": now - 24 * 60 * 60 * 1000,
    };

    const result = analyzeWardrobeRotation({
      wardrobe,
      history: [
        { history_id: "h1", item_ids: [], worn_at: "2026-03-01T10:00:00Z" },
      ],
      outfits: [],
      dismissedAlerts,
      now,
    });

    expect(result.state).toBe("healthy");
    expect(result.items).toEqual([]);
  });

  test("drops expired dismissals so alerts can return later", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
    ];

    const result = analyzeWardrobeRotation({
      wardrobe,
      history: [
        { history_id: "h1", item_ids: [], worn_at: "2026-03-01T10:00:00Z" },
      ],
      outfits: [],
      dismissedAlerts: {
        "shirt-1": now - (ROTATION_DISMISS_DAYS + 1) * 24 * 60 * 60 * 1000,
      },
      now,
    });

    expect(result.state).toBe("alert");
    expect(result.dismissedAlerts).toEqual({});
  });

  test("returns a healthy state when everything was worn recently", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
      { id: "pants-1", name: "Black Trousers", category: "bottoms" },
    ];

    const history = [
      {
        history_id: "h1",
        item_ids: ["shirt-1", "pants-1"],
        worn_at: "2026-04-01T10:00:00Z",
      },
    ];

    const result = analyzeWardrobeRotation({ wardrobe, history, outfits: [], now });

    expect(result.state).toBe("healthy");
    expect(result.items).toEqual([]);
  });

  test("guides guests to sign in before using rotation alerts", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
    ];

    const result = analyzeWardrobeRotation({
      wardrobe,
      history: [],
      outfits: [],
      isGuestMode: true,
      now,
    });

    expect(result.state).toBe("guest");
    expect(result.title).toMatch(/Sign in/i);
  });

  test("returns a disabled state when rotation alerts are turned off", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
    ];

    const result = analyzeWardrobeRotation({
      wardrobe,
      history: [
        { history_id: "h1", item_ids: [], worn_at: "2026-03-01T10:00:00Z" },
      ],
      outfits: [],
      preferences: { enabled: false, reminderPace: "balanced" },
      now,
    });

    expect(result.state).toBe("disabled");
    expect(result.items).toEqual([]);
    expect(result.title).toMatch(/off/i);
  });

  test("uses reminder pace to decide when dismissed alerts return", () => {
    const wardrobe = [
      { id: "shirt-1", name: "Blue Oxford", category: "tops" },
    ];
    const dismissedAt = now - 10 * 24 * 60 * 60 * 1000;

    const quietResult = analyzeWardrobeRotation({
      wardrobe,
      history: [
        { history_id: "h1", item_ids: [], worn_at: "2026-03-01T10:00:00Z" },
      ],
      outfits: [],
      dismissedAlerts: { "shirt-1": dismissedAt },
      preferences: { enabled: true, reminderPace: "quiet" },
      now,
    });

    const proactiveResult = analyzeWardrobeRotation({
      wardrobe,
      history: [
        { history_id: "h1", item_ids: [], worn_at: "2026-03-01T10:00:00Z" },
      ],
      outfits: [],
      dismissedAlerts: { "shirt-1": dismissedAt },
      preferences: { enabled: true, reminderPace: "proactive" },
      now,
    });

    expect(quietResult.state).toBe("healthy");
    expect(proactiveResult.state).toBe("alert");
  });
});
