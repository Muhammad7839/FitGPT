import { fetchAIRecommendations } from "./recommendationsApi";
import { apiFetch } from "./apiFetch";

jest.mock("./apiFetch", () => ({
  apiFetch: jest.fn(),
}));

describe("fetchAIRecommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiFetch.mockResolvedValue({ source: "ai", outfits: [] });
  });

  test("sends rich wardrobe metadata while preserving legacy fields", async () => {
    await fetchAIRecommendations(
      [
        {
          id: 7,
          name: "Navy Hoodie",
          category: "Outerwear",
          color: "Navy, White",
          fitTag: "relaxed",
          styleTags: ["casual", "activewear"],
          clothingType: "hoodie",
          layerType: "mid",
          isOnePiece: false,
          setId: "track-set",
          occasionTags: ["casual", "athletic"],
          seasonTags: ["fall", "winter"],
        },
      ],
      { weather_category: "cool" }
    );

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith(
      "/recommendations/ai",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: "7",
              name: "Navy Hoodie",
              category: "Outerwear",
              color: "Navy, White",
              colors: ["Navy", "White"],
              fit_type: "",
              fit_tag: "relaxed",
              style_tag: "",
              style_tags: ["casual", "activewear"],
              clothing_type: "hoodie",
              layer_type: "mid",
              is_one_piece: false,
              set_id: "track-set",
              occasion_tags: ["casual", "athletic"],
              season_tags: ["fall", "winter"],
            },
          ],
          context: { weather_category: "cool" },
        }),
      })
    );
  });

  test("normalizes comma-separated fallback metadata into arrays", async () => {
    await fetchAIRecommendations(
      [
        {
          id: "abc",
          name: "Summer Tee",
          category: "Tops",
          color: "Blue, White",
          style_tag: "casual",
          season_tags: "spring, summer",
        },
      ],
      {}
    );

    const [, request] = apiFetch.mock.calls[0];
    const payload = JSON.parse(request.body);

    expect(payload.items[0].colors).toEqual(["Blue", "White"]);
    expect(payload.items[0].style_tags).toEqual(["casual"]);
    expect(payload.items[0].season_tags).toEqual(["spring", "summer"]);
  });
});
