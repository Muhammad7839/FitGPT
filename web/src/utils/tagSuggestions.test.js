import { generateItemTagSuggestions } from "./tagSuggestions";
import { classifyFromUrl } from "./classifyClothing";

jest.mock("./classifyClothing", () => ({
  classifyFromUrl: jest.fn(),
}));

describe("generateItemTagSuggestions", () => {
  const originalImage = global.Image;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.clearAllMocks();

    global.Image = class MockImage {
      set src(_value) {
        if (typeof this.onload === "function") {
          this.width = 8;
          this.height = 8;
          this.onload();
        }
      }
    };

    jest.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName !== "canvas") {
        return originalCreateElement(tagName, options);
      }

      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: jest.fn(),
          getImageData: () => ({
            data: new Uint8ClampedArray([
              220, 38, 38, 255,
              220, 38, 38, 255,
              220, 38, 38, 255,
              220, 38, 38, 255,
            ]),
          }),
        }),
      };
    });
  });

  afterEach(() => {
    document.createElement.mockRestore();
    global.Image = originalImage;
  });

  test("builds ready suggestions from classification, colors, and file name", async () => {
    classifyFromUrl.mockResolvedValue({ category: "Outerwear", label: "parka" });

    const result = await generateItemTagSuggestions({
      imageUrl: "data:image/jpeg;base64,test",
      fileName: "winter-parka.jpg",
      fallbackCategory: "Tops",
    });

    expect(result.category).toBe("Outerwear");
    expect(result.status).toBe("ready");
    expect(result.suggestions).toEqual(
      expect.objectContaining({
        color: "Red",
        clothingType: "parka",
      })
    );
    expect(result.suggestions.seasonTags).toEqual(expect.arrayContaining(["fall", "winter"]));
    expect(result.message).toMatch(/suggested tags/i);
  });

  test("falls back gracefully when classification and colors fail", async () => {
    classifyFromUrl.mockRejectedValue(new Error("classifier failed"));
    global.Image = class BrokenImage {
      set src(_value) {
        if (typeof this.onerror === "function") this.onerror(new Error("broken"));
      }
    };

    const result = await generateItemTagSuggestions({
      imageUrl: "data:image/jpeg;base64,test",
      fileName: "plain-tee.jpg",
      fallbackCategory: "Tops",
    });

    expect(result.category).toBe("Tops");
    expect(result.suggestions.clothingType).toBe("t-shirt");
    expect(result.suggestions.styleTags).toEqual(expect.arrayContaining(["casual"]));
    expect(result.status === "partial" || result.status === "ready").toBe(true);
  });
});
