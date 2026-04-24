import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TripPackingPlanner from "./TripPackingPlanner";
import { getDestinationWeatherForecast } from "../api/weatherApi";
import { tripPackingApi } from "../api/tripPackingApi";

jest.mock("../api/weatherApi", () => ({
  getDestinationWeatherForecast: jest.fn(),
}));

jest.mock("../api/tripPackingApi", () => ({
  tripPackingApi: {
    listTrips: jest.fn(),
    createTrip: jest.fn(),
    updateTrip: jest.fn(),
    removeTrip: jest.fn(),
  },
}));

const wardrobe = [
  { id: "top-1", name: "White Tee", category: "Tops", clothing_type: "t-shirt", is_active: true },
  { id: "bottom-1", name: "Wide Leg Trousers", category: "Bottoms", clothing_type: "trousers", is_active: true },
  { id: "shoe-1", name: "Walking Sneakers", category: "Shoes", clothing_type: "sneakers", is_active: true },
];

describe("TripPackingPlanner", () => {
  let tripsStore;

  beforeEach(() => {
    tripsStore = [];

    tripPackingApi.listTrips.mockImplementation(async () => ({ trips: tripsStore }));
    tripPackingApi.createTrip.mockImplementation(async (payload) => {
      const trip = {
        trip_id: "trip-1",
        created_at: "2026-04-05T00:00:00.000Z",
        updated_at: "2026-04-05T00:00:00.000Z",
        ...payload,
      };
      tripsStore = [trip];
      return { created: true, trip };
    });
    tripPackingApi.updateTrip.mockImplementation(async (tripId, patch) => {
      tripsStore = tripsStore.map((trip) => (trip.trip_id === tripId ? { ...trip, ...patch } : trip));
      return { updated: true, trip: tripsStore.find((trip) => trip.trip_id === tripId) };
    });
    tripPackingApi.removeTrip.mockResolvedValue({ deleted: true });

    getDestinationWeatherForecast.mockResolvedValue({
      status: "fallback",
      source: "fallback",
      location: null,
      days: [],
      message: "Weather data is unavailable, showing general packing suggestions.",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("surfaces required and optional trip inputs clearly in the builder", async () => {
    render(<TripPackingPlanner wardrobe={wardrobe} user={null} answers={{}} />);

    expect(await screen.findByText("Pack for the trip you are excited to take")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add trip/i }));

    expect(screen.getByText("Required to generate")).toBeInTheDocument();
    expect(screen.getByText("Destination and travel dates")).toBeInTheDocument();
    expect(screen.getByText("Optional trip context")).toBeInTheDocument();
    expect(screen.getByText("Shape the vibe of the trip")).toBeInTheDocument();
    expect(screen.getByText("Destination + dates needed")).toBeInTheDocument();
  });

  test("generates and displays a fallback packing list with the approved copy", async () => {
    render(<TripPackingPlanner wardrobe={wardrobe} user={null} answers={{}} />);

    await screen.findByText("Pack for the trip you are excited to take");
    fireEvent.click(screen.getByRole("button", { name: /add trip/i }));

    fireEvent.change(screen.getByPlaceholderText(/city, region, or destination/i), { target: { value: "Seattle" } });

    fireEvent.click(screen.getByRole("button", { name: /start date:/i }));
    fireEvent.click(screen.getByRole("button", { name: "Friday, April 10, 2026" }));

    fireEvent.click(screen.getByRole("button", { name: /end date:/i }));
    fireEvent.click(screen.getByRole("button", { name: "Monday, April 13, 2026" }));

    fireEvent.click(screen.getByRole("button", { name: /generate packing list/i }));

    await waitFor(() => expect(tripPackingApi.createTrip).toHaveBeenCalled());

    const packingListLabels = await screen.findAllByText("Your packing list");
    expect(packingListLabels.length).toBeGreaterThan(0);
    expect(screen.getByText("Suggested items for your trip")).toBeInTheDocument();
    expect(screen.getByText("Daily outfit ideas")).toBeInTheDocument();
    expect(screen.getByText(/Based on your destination and trip length:/i)).toBeInTheDocument();
    expect(screen.getByText("Weather data is unavailable, showing general packing suggestions.")).toBeInTheDocument();
    expect(screen.getByText(/owned picks/i)).toBeInTheDocument();
  });

  test("keeps saved trip details collapsed until a trip card is opened", async () => {
    tripsStore = [
      {
        trip_id: "trip-existing",
        destination: "Boston",
        destination_label: "Boston",
        start_date: "2026-04-10",
        end_date: "2026-04-13",
        trip_purpose: "City weekend",
        luggage_mode: "carry-on",
        activities: ["Dinner"],
        packing_groups: [],
        outfit_plan: [],
        summary: { durationDays: 4, weatherLabel: "Cool and breezy", totalItemCount: 6 },
        forecast: { status: "fallback", days: [], message: "Weather data is unavailable, showing general packing suggestions." },
      },
    ];

    render(<TripPackingPlanner wardrobe={wardrobe} user={null} answers={{}} />);

    expect(await screen.findByText("Boston")).toBeInTheDocument();
    expect(screen.queryByText("Suggested items for your trip")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /boston/i }));

    expect(await screen.findByText("Suggested items for your trip")).toBeInTheDocument();
  });
});
