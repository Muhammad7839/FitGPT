import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockWardrobe = [
  { id: "1", name: "White Tee", category: "Tops", color: "white" },
  { id: "2", name: "Black Jeans", category: "Bottoms", color: "black" },
  { id: "3", name: "White Sneakers", category: "Shoes", color: "white" },
  { id: "4", name: "Denim Jacket", category: "Outerwear", color: "blue", layer_type: "outer" },
];

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "demo-user", body_type: "rectangle" },
  }),
}));

jest.mock("../utils/userStorage", () => {
  const actual = jest.requireActual("../utils/userStorage");
  return {
    ...actual,
    loadWardrobe: () => mockWardrobe,
  };
});

jest.mock("./MannequinViewer", () => ({
  __esModule: true,
  default: ({ outfit }) => (
    <div data-testid="mannequin-viewer">3D preview for {outfit.length} items</div>
  ),
}));

jest.mock("../api/savedOutfitsApi", () => ({
  savedOutfitsApi: {
    saveOutfit: jest.fn(async () => ({ created: true, message: "Saved." })),
  },
}));

import OutfitBuilder from "./OutfitBuilder";
import { savedOutfitsApi } from "../api/savedOutfitsApi";

describe("OutfitBuilder", () => {
  beforeEach(() => {
    savedOutfitsApi.saveOutfit.mockClear();
  });

  test("renders wardrobe groups and items", () => {
    render(<OutfitBuilder />);

    expect(screen.getByText(/Outfit Builder/i)).toBeInTheDocument();
    expect(screen.getByText("Tops")).toBeInTheDocument();
    expect(screen.getByText("Bottoms")).toBeInTheDocument();
    expect(screen.getByText("Shoes")).toBeInTheDocument();
    expect(screen.getByText("White Tee")).toBeInTheDocument();
  });

  test("lets users add items and switch to 3D preview", () => {
    render(<OutfitBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /White Tee/i }));
    fireEvent.click(screen.getByRole("button", { name: /Black Jeans/i }));
    fireEvent.click(screen.getByRole("button", { name: /White Sneakers/i }));
    fireEvent.click(screen.getByRole("button", { name: "3D" }));

    expect(screen.getByTestId("mannequin-viewer")).toHaveTextContent("3D preview for 3 items");
  });

  test("prevents saving when layering conflicts exist", async () => {
    render(<OutfitBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /Denim Jacket/i }));

    expect(screen.getByText(/^Layering conflicts$/i)).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /Save outfit/i });
    expect(saveButton).toBeDisabled();
    expect(savedOutfitsApi.saveOutfit).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText(/should sit over a shirt or one-piece/i)).toBeInTheDocument();
    });
  });

  test("saves a valid outfit", async () => {
    render(<OutfitBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /White Tee/i }));
    fireEvent.click(screen.getByRole("button", { name: /Black Jeans/i }));
    fireEvent.click(screen.getByRole("button", { name: /White Sneakers/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save outfit/i }));

    await waitFor(() => {
      expect(savedOutfitsApi.saveOutfit).toHaveBeenCalledWith(
        expect.objectContaining({
          items: ["1", "2", "3"],
          source: "user_built",
        }),
        expect.objectContaining({ id: "demo-user" })
      );
    });

    expect(screen.getByText(/Saved\.|Already saved\./)).toBeInTheDocument();
  });
});
