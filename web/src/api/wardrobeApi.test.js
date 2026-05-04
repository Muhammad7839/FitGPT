import { wardrobeApi } from "./wardrobeApi";
import { apiFetch, hasApi } from "./apiFetch";

jest.mock("./apiFetch", () => ({
  apiFetch: jest.fn(),
  hasApi: jest.fn(),
}));

describe("wardrobeApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasApi.mockReturnValue(true);
    apiFetch.mockResolvedValue({ id: "1", image_url: "/uploads/server-only.jpg" });
  });

  test("does not send local wardrobe images when creating an item", async () => {
    const dataUrl = "data:image/jpeg;base64,abc";
    const created = await wardrobeApi.createItem({
      name: "Oxford Shirt",
      category: "top",
      image_url: dataUrl,
      imageFile: new File(["image"], "shirt.jpg", { type: "image/jpeg" }),
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/wardrobe/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Oxford Shirt",
          category: "top",
        }),
      })
    );
    expect(created.image_url).toBe(dataUrl);
  });

  test("does not send local wardrobe images when updating an item", async () => {
    const dataUrl = "data:image/jpeg;base64,local";
    const updated = await wardrobeApi.updateItem("7", {
      name: "Oxford Shirt",
      image_url: dataUrl,
      imageFile: new File(["image"], "shirt.jpg", { type: "image/jpeg" }),
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/wardrobe/items/7",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          name: "Oxford Shirt",
        }),
      })
    );
    expect(updated.image_url).toBe(dataUrl);
  });
});
