import { buildChatContext } from "./chatApi";

describe("buildChatContext", () => {
  test("returns null when no wardrobe and no answers", () => {
    expect(buildChatContext([], {})).toBe(null);
    expect(buildChatContext(null, null)).toBe(null);
    expect(buildChatContext(undefined, undefined)).toBe(null);
  });

  test("builds wardrobe summary from active items", () => {
    const items = [
      { name: "White Tee", category: "Tops", color: "white", is_active: true },
      { name: "Black Jeans", category: "Bottoms", color: "black", is_active: true },
      { name: "Archived Coat", category: "Outerwear", color: "gray", is_active: false },
    ];
    const ctx = buildChatContext(items, {});
    expect(ctx).not.toBe(null);
    expect(ctx.wardrobe_summary).toContain("2 items");
    expect(ctx.wardrobe_summary).toContain("White Tee");
    expect(ctx.wardrobe_summary).toContain("Black Jeans");
    expect(ctx.wardrobe_summary).not.toContain("Archived Coat");
  });

  test("excludes image_url from wardrobe summary", () => {
    const items = [
      { name: "Shirt", category: "Tops", color: "blue", image_url: "data:image/jpeg;base64,abc123", is_active: true },
    ];
    const ctx = buildChatContext(items, {});
    expect(ctx.wardrobe_summary).not.toContain("data:image");
    expect(ctx.wardrobe_summary).not.toContain("base64");
  });

  test("includes fit_tag and clothing_type when present", () => {
    const items = [
      { name: "Slim Polo", category: "Tops", color: "navy", fit_tag: "slim", clothing_type: "polo", is_active: true },
    ];
    const ctx = buildChatContext(items, {});
    expect(ctx.wardrobe_summary).toContain("slim");
    expect(ctx.wardrobe_summary).toContain("polo");
  });

  test("skips unknown/unspecified fit tags", () => {
    const items = [
      { name: "Tee", category: "Tops", color: "white", fit_tag: "unknown", is_active: true },
      { name: "Jeans", category: "Bottoms", color: "blue", fit_tag: "unspecified", is_active: true },
    ];
    const ctx = buildChatContext(items, {});
    expect(ctx.wardrobe_summary).not.toContain("unknown");
    expect(ctx.wardrobe_summary).not.toContain("unspecified");
  });

  test("builds preferences string from answers", () => {
    const answers = {
      style: ["casual", "smart casual"],
      comfort: ["Relaxed"],
      dressFor: ["work", "social"],
      bodyType: "hourglass",
    };
    const ctx = buildChatContext([], answers);
    expect(ctx).not.toBe(null);
    expect(ctx.preferences).toContain("Style: casual, smart casual");
    expect(ctx.preferences).toContain("Comfort: Relaxed");
    expect(ctx.preferences).toContain("Occasions: work, social");
    expect(ctx.preferences).toContain("Body type: hourglass");
  });

  test("returns null when answers have no relevant fields", () => {
    expect(buildChatContext([], { someOther: "value" })).toBe(null);
  });

  test("combines wardrobe and preferences", () => {
    const items = [
      { name: "Blazer", category: "Outerwear", color: "navy", is_active: true },
    ];
    const answers = { style: ["formal"], bodyType: "rectangle" };
    const ctx = buildChatContext(items, answers);
    expect(ctx.wardrobe_summary).toContain("Blazer");
    expect(ctx.preferences).toContain("formal");
    expect(ctx.preferences).toContain("rectangle");
  });

  test("handles large wardrobe without crashing", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      name: `Item ${i}`,
      category: "Tops",
      color: "blue",
      is_active: true,
    }));
    const ctx = buildChatContext(items, {});
    expect(ctx.wardrobe_summary).toContain("100 items");
  });
});
