import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children }) => <div data-testid="mock-canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ viewport: { width: 1, height: 1 } }),
}));
jest.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));
jest.mock("three", () => ({
  Color: class { multiplyScalar() { return this; } getStyle() { return "#888"; } },
  MathUtils: { lerp: (a, b, t) => a + (b - a) * t },
  DoubleSide: 2,
  CatmullRomCurve3: class {},
  Shape: class { moveTo() {} bezierCurveTo() {} quadraticCurveTo() {} lineTo() {} },
}));

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

const mockWardrobe = [
  { id: "1", name: "White Tee", category: "Tops", color: "white" },
  { id: "2", name: "Black Jeans", category: "Bottoms", color: "black" },
  { id: "3", name: "Sneakers", category: "Shoes", color: "white" },
];

jest.mock("../utils/userStorage", () => {
  const actual = jest.requireActual("../utils/userStorage");
  return {
    ...actual,
    loadWardrobe: () => mockWardrobe,
  };
});

jest.mock("../api/savedOutfitsApi", () => ({
  savedOutfitsApi: {
    saveOutfit: jest.fn(async () => ({ created: true, message: "Saved." })),
  },
}));

import OutfitBuilder from "./OutfitBuilder";
import { savedOutfitsApi } from "../api/savedOutfitsApi";

function renderBuilder() {
  return render(<OutfitBuilder />);
}

describe("OutfitBuilder", () => {
  beforeEach(() => {
    savedOutfitsApi.saveOutfit.mockClear();
  });

  test("renders wardrobe items grouped by category", () => {
    renderBuilder();
    expect(screen.getByText(/Outfit Builder/i)).toBeInTheDocument();
    expect(screen.getByText("Tops")).toBeInTheDocument();
    expect(screen.getByText("Bottoms")).toBeInTheDocument();
    expect(screen.getByText("Shoes")).toBeInTheDocument();
    expect(screen.getByText("White Tee")).toBeInTheDocument();
  });

  test("clicking wardrobe item adds it to outfit", () => {
    renderBuilder();
    const items = screen.getAllByTitle(/Click or drag to add/i);
    fireEvent.click(items[0]);
    expect(screen.getByText(/Your outfit · 1 item/i)).toBeInTheDocument();
  });

  test("clicking same item in wardrobe again removes it", () => {
    renderBuilder();
    const btn = screen.getAllByTitle(/Click or drag to add/i)[0];
    fireEvent.click(btn);
    expect(screen.getByText(/Your outfit · 1 item/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle(/Click to remove from outfit/i));
    expect(screen.getByText(/Your outfit · 0 items/i)).toBeInTheDocument();
  });

  test("Save button disabled with empty outfit", () => {
    renderBuilder();
    const saveBtn = screen.getByRole("button", { name: /Save outfit/i });
    expect(saveBtn).toBeDisabled();
  });

  test("Save button triggers savedOutfitsApi.saveOutfit when valid", async () => {
    renderBuilder();
    const buttons = screen.getAllByTitle(/Click or drag to add/i);
    buttons.forEach((b) => fireEvent.click(b));
    const saveBtn = screen.getByRole("button", { name: /Save outfit/i });
    fireEvent.click(saveBtn);
    await waitFor(() => expect(savedOutfitsApi.saveOutfit).toHaveBeenCalled());
  });

});
