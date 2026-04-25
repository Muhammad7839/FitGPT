import {
  PERSONALIZATION_ACTIONS,
  buildRecommendationPersonalizationProfile,
  describeRecommendationPersonalization,
  personalizationBiasForOutfit,
  readRecommendationPersonalization,
  trackRecommendationPersonalization,
} from "./recommendationPersonalization";
import { generateThreeOutfits, scoreOutfitForDisplay } from "./recommendationEngine";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("recommendation personalization storage", () => {
  const outfit = [
    { id: "top-1", name: "Blue Oxford", category: "Tops", color: "Blue", fit_tag: "tailored", style_tags: ["work"] },
    { id: "bottom-1", name: "Navy Trousers", category: "Bottoms", color: "Navy", fit_tag: "regular", style_tags: ["work"] },
    { id: "shoe-1", name: "Brown Loafers", category: "Shoes", color: "Brown", fit_tag: "regular" },
  ];

  test("tracks recommendation selections per user", () => {
    const user = { id: "u1" };

    const result = trackRecommendationPersonalization({
      user,
      outfit,
      action: PERSONALIZATION_ACTIONS.SELECT,
    });

    const state = readRecommendationPersonalization(user);
    const stored = state.entriesBySignature[result.signature];

    expect(stored.counts.selected).toBe(1);
    expect(stored.colors).toEqual(expect.arrayContaining(["blue", "navy", "brown"]));
  });
});

describe("recommendation personalization scoring", () => {
  const wardrobe = [
    { id: "top-a", name: "Blue Oxford", category: "Tops", color: "Blue", fit_tag: "tailored", is_active: true, style_tags: ["work"] },
    { id: "top-b", name: "Cream Tee", category: "Tops", color: "Cream", fit_tag: "regular", is_active: true, style_tags: ["casual"] },
    { id: "bottom-a", name: "Navy Trousers", category: "Bottoms", color: "Navy", fit_tag: "regular", is_active: true, style_tags: ["work"] },
    { id: "bottom-b", name: "Black Jeans", category: "Bottoms", color: "Black", fit_tag: "regular", is_active: true, style_tags: ["casual"] },
    { id: "shoe-a", name: "Brown Loafers", category: "Shoes", color: "Brown", fit_tag: "regular", is_active: true },
    { id: "shoe-b", name: "White Sneakers", category: "Shoes", color: "White", fit_tag: "regular", is_active: true },
  ];

  const likedShape = [
    { id: "top-a", name: "Blue Oxford", category: "Tops", color: "Blue", fit_tag: "tailored", style_tags: ["work"] },
    { id: "bottom-a", name: "Navy Trousers", category: "Bottoms", color: "Navy", fit_tag: "regular", style_tags: ["work"] },
    { id: "shoe-a", name: "Brown Loafers", category: "Shoes", color: "Brown", fit_tag: "regular" },
  ];

  const similarOutfit = [
    { id: "top-c", name: "Blue Knit Polo", category: "Tops", color: "Blue", fit_tag: "tailored", style_tags: ["work"] },
    { id: "bottom-c", name: "Gray Trousers", category: "Bottoms", color: "Gray", fit_tag: "regular", style_tags: ["work"] },
    { id: "shoe-c", name: "Brown Derbies", category: "Shoes", color: "Brown", fit_tag: "regular" },
  ];

  test("combines selections, saved outfits, and history into one profile", () => {
    const tracked = trackRecommendationPersonalization({
      user: null,
      outfit: likedShape,
      action: PERSONALIZATION_ACTIONS.SELECT,
    });

    const profile = buildRecommendationPersonalizationProfile({
      interactionState: tracked.state,
      savedOutfits: [
        {
          outfit_signature: "top-a|bottom-a|shoe-a",
          item_details: likedShape,
          created_at: new Date().toISOString(),
        },
      ],
      historyEntries: [
        {
          item_ids: ["top-a", "bottom-a", "shoe-a"],
          worn_at: new Date().toISOString(),
        },
      ],
      wardrobe,
    });

    expect(profile.sourceCounts.selected).toBeGreaterThan(0);
    expect(profile.sourceCounts.saved).toBeGreaterThan(0);
    expect(profile.sourceCounts.history).toBeGreaterThan(0);
    expect(personalizationBiasForOutfit(similarOutfit, profile)).toBeGreaterThan(0);
  });

  test("display scoring accepts personalization bias without regressing", () => {
    const tracked = trackRecommendationPersonalization({
      user: null,
      outfit: likedShape,
      action: PERSONALIZATION_ACTIONS.SELECT,
    });

    const profile = buildRecommendationPersonalizationProfile({
      interactionState: tracked.state,
      savedOutfits: [],
      historyEntries: [],
      wardrobe,
    });

    const withPersonalization = scoreOutfitForDisplay(similarOutfit, {
      weatherCategory: "mild",
      timeCategory: "work hours",
      bodyTypeId: "rectangle",
      personalizationProfile: profile,
    });

    const withoutPersonalization = scoreOutfitForDisplay(similarOutfit, {
      weatherCategory: "mild",
      timeCategory: "work hours",
      bodyTypeId: "rectangle",
      personalizationProfile: null,
    });

    expect(personalizationBiasForOutfit(similarOutfit, profile)).toBeGreaterThan(0);
    expect(withPersonalization).toBeGreaterThanOrEqual(withoutPersonalization);
  });

  test("generator still returns three outfits when personalization is provided", () => {
    const tracked = trackRecommendationPersonalization({
      user: null,
      outfit: likedShape,
      action: PERSONALIZATION_ACTIONS.SELECT,
    });

    const outfits = generateThreeOutfits(
      wardrobe,
      42,
      "rectangle",
      new Set(),
      new Map(),
      "mild",
      "work hours",
      null,
      new Set(),
      {
        personalizationProfile: buildRecommendationPersonalizationProfile({
          interactionState: tracked.state,
          savedOutfits: [],
          historyEntries: [],
          wardrobe,
        }),
      }
    );

    expect(outfits).toHaveLength(3);
  });
});

describe("recommendation personalization messaging", () => {
  test("shows a fallback message for new users", () => {
    expect(describeRecommendationPersonalization(null, 0)).toMatchObject({
      label: "Based on your preferences",
      tone: "new",
    });
  });

  test("shows stronger messaging once enough data exists", () => {
    const profile = {
      signalCount: 5.5,
      isEstablished: true,
    };

    expect(describeRecommendationPersonalization(profile, 2)).toMatchObject({
      label: "Recommended for you",
      tone: "established",
    });
  });
});
