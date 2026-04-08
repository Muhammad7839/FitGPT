import {
  buildFallbackPlanningSuggestion,
  buildForecastSuggestions,
  forecastWeatherCategory,
  scoreOutfitForForecast,
} from "./forecastPlanner";

const rainDay = {
  date: "2026-04-05",
  condition: "Rain",
  conditionKey: "rain",
  tempHighF: 49,
  tempLowF: 39,
  averageTempF: 44,
  precipitationChance: 82,
  precipitationIn: 0.44,
  windMph: 21,
};

const hotDay = {
  date: "2026-07-10",
  condition: "Clear",
  conditionKey: "clear",
  tempHighF: 91,
  tempLowF: 74,
  averageTempF: 82,
  precipitationChance: 5,
  precipitationIn: 0,
  windMph: 7,
};

const rainReadyOutfit = [
  { id: "coat", name: "Rain Jacket", category: "Outerwear", clothing_type: "windbreaker", layer_type: "outer", color: "Navy" },
  { id: "top", name: "Merino Sweater", category: "Tops", clothing_type: "sweater", layer_type: "mid", color: "Gray" },
  { id: "bottom", name: "Black Jeans", category: "Bottoms", clothing_type: "jeans", color: "Black" },
  { id: "shoe", name: "Chelsea Boots", category: "Shoes", clothing_type: "boots", color: "Brown" },
];

const hotDayOutfit = [
  { id: "tee", name: "Linen Tee", category: "Tops", clothing_type: "t-shirt", layer_type: "base", color: "White" },
  { id: "shorts", name: "Cotton Shorts", category: "Bottoms", clothing_type: "shorts", color: "Tan" },
  { id: "sandal", name: "Slide Sandals", category: "Shoes", clothing_type: "sandals", color: "Beige" },
];

describe("forecastWeatherCategory", () => {
  test("uses temperature with wet and windy adjustments", () => {
    expect(forecastWeatherCategory(rainDay)).toBe("cold");
    expect(forecastWeatherCategory(hotDay)).toBe("warm");
  });
});

describe("scoreOutfitForForecast", () => {
  test("prefers protective outfits on wet cold days", () => {
    expect(scoreOutfitForForecast(rainReadyOutfit, rainDay)).toBeGreaterThan(
      scoreOutfitForForecast(hotDayOutfit, rainDay)
    );
  });

  test("prefers lighter outfits on hot clear days", () => {
    expect(scoreOutfitForForecast(hotDayOutfit, hotDay)).toBeGreaterThan(
      scoreOutfitForForecast(rainReadyOutfit, hotDay)
    );
  });
});

describe("buildForecastSuggestions", () => {
  const wardrobe = [
    ...rainReadyOutfit,
    ...hotDayOutfit,
    { id: "tee-2", name: "Blue Tee", category: "Tops", clothing_type: "t-shirt", layer_type: "base", color: "Blue" },
    { id: "pants-2", name: "Chino Pants", category: "Bottoms", clothing_type: "pants", color: "Khaki" },
    { id: "shoe-2", name: "White Sneakers", category: "Shoes", clothing_type: "sneakers", color: "White" },
  ];

  test("builds one suggestion per forecast day", () => {
    const suggestions = buildForecastSuggestions({
      wardrobe,
      forecastDays: [rainDay, hotDay],
      seedNumber: 42,
      bodyTypeId: "rectangle",
      answers: { style: ["casual"] },
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].outfit.length).toBeGreaterThan(0);
    expect(suggestions[0].note).toBeTruthy();
    expect(suggestions[1].summary).toMatch(/precip|wind|f/i);
  });
});

describe("buildFallbackPlanningSuggestion", () => {
  test("returns a balanced fallback outfit when weather is unavailable", () => {
    const suggestion = buildFallbackPlanningSuggestion({
      wardrobe: [
        { id: "top", name: "White Tee", category: "Tops", clothing_type: "t-shirt", color: "White" },
        { id: "bottom", name: "Blue Jeans", category: "Bottoms", clothing_type: "jeans", color: "Blue" },
        { id: "shoe", name: "Sneakers", category: "Shoes", clothing_type: "sneakers", color: "White" },
      ],
      seedNumber: 7,
    });

    expect(suggestion.outfit.length).toBeGreaterThan(0);
    expect(suggestion.note).toMatch(/weather data is unavailable/i);
  });
});
