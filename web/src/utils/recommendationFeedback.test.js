import {
  FEEDBACK_SIGNALS,
  buildRecommendationFeedbackProfile,
  feedbackBiasForOutfit,
  getRecommendationFeedback,
  readRecommendationFeedback,
  restoreRecommendationFeedback,
  upsertRecommendationFeedback,
} from "./recommendationFeedback";
import { generateThreeOutfits, scoreOutfitForDisplay } from "./recommendationEngine";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("recommendation feedback storage", () => {
  const outfit = [
    { id: "top-1", name: "Cream Tee", category: "Tops", color: "Cream", fit_tag: "regular", style_tags: ["casual"] },
    { id: "bottom-1", name: "Black Jeans", category: "Bottoms", color: "Black", fit_tag: "regular" },
    { id: "shoe-1", name: "White Sneakers", category: "Shoes", color: "White", fit_tag: "regular" },
  ];

  test("stores feedback per user and exposes it by signature", () => {
    const user = { id: "u1" };

    const result = upsertRecommendationFeedback({
      user,
      outfit,
      signal: FEEDBACK_SIGNALS.LIKE,
      detailCode: "color",
    });

    const state = readRecommendationFeedback(user);
    const stored = getRecommendationFeedback(state, result.signature);

    expect(stored).toMatchObject({
      signal: "like",
      detailCode: "color",
    });
    expect(stored.colors).toContain("beige");
    expect(stored.categories).toEqual(expect.arrayContaining(["tops", "bottoms", "shoes"]));
  });

  test("can restore the previous feedback entry for undo", () => {
    const user = { id: "u1" };

    const first = upsertRecommendationFeedback({
      user,
      outfit,
      signal: FEEDBACK_SIGNALS.LIKE,
    });

    const second = upsertRecommendationFeedback({
      user,
      outfit,
      signal: FEEDBACK_SIGNALS.DISLIKE,
      detailCode: "style",
    });

    const restored = restoreRecommendationFeedback({
      user,
      signature: second.signature,
      previousEntry: second.previousEntry,
    });

    expect(getRecommendationFeedback(restored, first.signature)).toMatchObject({
      signal: "like",
    });
  });
});

describe("recommendation feedback scoring", () => {
  const likedOutfit = [
    { id: "top-a", name: "Blue Oxford", category: "Tops", color: "Blue", fit_tag: "tailored", style_tags: ["work"] },
    { id: "bottom-a", name: "Navy Trousers", category: "Bottoms", color: "Navy", fit_tag: "regular", style_tags: ["work"] },
    { id: "shoe-a", name: "Loafers", category: "Shoes", color: "Brown", fit_tag: "regular" },
  ];

  const similarOutfit = [
    { id: "top-b", name: "Blue Knit Polo", category: "Tops", color: "Blue", fit_tag: "tailored", style_tags: ["work"] },
    { id: "bottom-b", name: "Charcoal Trousers", category: "Bottoms", color: "Gray", fit_tag: "regular", style_tags: ["work"] },
    { id: "shoe-b", name: "Brown Derbies", category: "Shoes", color: "Brown", fit_tag: "regular" },
  ];

  test("prefers outfits that align with liked feedback signals", () => {
    const result = upsertRecommendationFeedback({
      user: null,
      outfit: likedOutfit,
      signal: FEEDBACK_SIGNALS.LIKE,
      detailCode: "style",
    });

    const profile = buildRecommendationFeedbackProfile(result.state);
    const bias = feedbackBiasForOutfit(similarOutfit, profile);

    expect(bias).toBeGreaterThan(0);
  });

  test("display score reflects dislike bias", () => {
    const result = upsertRecommendationFeedback({
      user: null,
      outfit: likedOutfit,
      signal: FEEDBACK_SIGNALS.DISLIKE,
      detailCode: "color",
    });

    const profile = buildRecommendationFeedbackProfile(result.state);
    expect(feedbackBiasForOutfit(similarOutfit, profile)).toBeLessThan(0);
    expect(scoreOutfitForDisplay(similarOutfit, {
      weatherCategory: "mild",
      timeCategory: "work hours",
      bodyTypeId: "rectangle",
      feedbackProfile: profile,
    })).toBeGreaterThanOrEqual(0);
  });

  test("generator still returns three outfits when feedback profile is provided", () => {
    const wardrobe = [
      { id: "t1", name: "Blue Oxford", category: "Tops", color: "Blue", fit_tag: "tailored", is_active: true, style_tags: ["work"] },
      { id: "t2", name: "Cream Tee", category: "Tops", color: "Cream", fit_tag: "regular", is_active: true, style_tags: ["casual"] },
      { id: "b1", name: "Navy Trousers", category: "Bottoms", color: "Navy", fit_tag: "regular", is_active: true, style_tags: ["work"] },
      { id: "b2", name: "Black Jeans", category: "Bottoms", color: "Black", fit_tag: "regular", is_active: true, style_tags: ["casual"] },
      { id: "s1", name: "Brown Loafers", category: "Shoes", color: "Brown", fit_tag: "regular", is_active: true },
      { id: "s2", name: "White Sneakers", category: "Shoes", color: "White", fit_tag: "regular", is_active: true },
    ];

    const result = upsertRecommendationFeedback({
      user: null,
      outfit: likedOutfit,
      signal: FEEDBACK_SIGNALS.LIKE,
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
      { feedbackProfile: buildRecommendationFeedbackProfile(result.state) }
    );

    expect(outfits).toHaveLength(3);
  });
});
