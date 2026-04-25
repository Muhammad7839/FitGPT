import { buildTripDateRange, generateTripPackingPlan, tripDurationDays } from "./tripPacking";

const wardrobe = [
  { id: "top-1", name: "White Tee", category: "Tops", clothing_type: "t-shirt", color: "White", is_active: true },
  { id: "top-2", name: "Merino Sweater", category: "Tops", clothing_type: "sweater", color: "Gray", is_active: true },
  { id: "bottom-1", name: "Blue Jeans", category: "Bottoms", clothing_type: "jeans", color: "Blue", is_active: true },
  { id: "outer-1", name: "Rain Jacket", category: "Outerwear", clothing_type: "rain jacket", color: "Navy", is_active: true },
  { id: "shoe-1", name: "Chelsea Boots", category: "Shoes", clothing_type: "boots", color: "Brown", is_active: true },
  { id: "acc-1", name: "Wool Scarf", category: "Accessories", clothing_type: "scarf", color: "Gray", is_active: true },
];

describe("trip packing helpers", () => {
  test("calculates inclusive trip duration", () => {
    expect(tripDurationDays("2026-04-10", "2026-04-13")).toBe(4);
  });

  test("builds a full date range", () => {
    expect(buildTripDateRange("2026-04-10", "2026-04-12")).toEqual([
      "2026-04-10",
      "2026-04-11",
      "2026-04-12",
    ]);
  });

  test("creates weather-aware packing groups and quantities", () => {
    const plan = generateTripPackingPlan({
      wardrobe,
      destination: "Paris",
      destinationLabel: "Paris, France",
      startDate: "2026-04-10",
      endDate: "2026-04-13",
      luggageMode: "checked",
      activities: ["Museum visits", "Dinner out"],
      forecast: {
        status: "ok",
        days: [
          { date: "2026-04-10", tempHighF: 54, tempLowF: 42, precipitationChance: 68, conditionKey: "rain" },
          { date: "2026-04-11", tempHighF: 57, tempLowF: 44, precipitationChance: 22, conditionKey: "cloudy" },
          { date: "2026-04-12", tempHighF: 59, tempLowF: 45, precipitationChance: 10, conditionKey: "clear" },
          { date: "2026-04-13", tempHighF: 52, tempLowF: 40, precipitationChance: 48, conditionKey: "rain" },
        ],
      },
    });

    const outerwear = plan.packing_groups.find((group) => group.key === "outerwear");
    const essentials = plan.packing_groups.find((group) => group.key === "essentials");

    expect(plan.summary.durationDays).toBe(4);
    expect(plan.summary.weatherLabel).toMatch(/weather/i);
    expect(plan.outfit_plan).toHaveLength(4);
    expect(plan.outfit_plan[0]).toEqual(expect.objectContaining({ date: "2026-04-10" }));
    expect(outerwear.totalQuantity).toBeGreaterThan(0);
    expect(outerwear.items[0].name).toMatch(/rain|jacket|layer/i);
    expect(essentials.items.find((item) => item.name === "Underwear").quantity).toBe(8);
  });

  test("falls back to general suggestions when wardrobe is empty", () => {
    const plan = generateTripPackingPlan({
      wardrobe: [],
      destination: "Lisbon",
      destinationLabel: "Lisbon, Portugal",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      luggageMode: "carry-on",
      activities: ["City exploring"],
      forecast: {
        status: "fallback",
        days: [],
      },
    });

    const tops = plan.packing_groups.find((group) => group.key === "tops");
    expect(tops.items[0].owned).toBe(false);
    expect(plan.summary.totalItemCount).toBeGreaterThan(0);
    expect(plan.outfit_plan).toHaveLength(3);
  });
});
