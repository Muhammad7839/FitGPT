import { conditionFromWeatherCode, getDestinationWeatherForecast, getWeatherForecast } from "./weatherApi";

describe("conditionFromWeatherCode", () => {
  test("maps storm codes to a storm condition", () => {
    expect(conditionFromWeatherCode(95)).toEqual(
      expect.objectContaining({ label: "Thunderstorm", key: "storm" })
    );
  });

  test("returns a mixed fallback for unknown values", () => {
    expect(conditionFromWeatherCode("bad-value")).toEqual(
      expect.objectContaining({ label: "Mixed conditions", key: "mixed" })
    );
  });
});

describe("getWeatherForecast", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: jest.fn((success) => success({ coords: { latitude: 41.9, longitude: -87.6 } })),
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("normalizes forecast days from Open-Meteo", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: ["2026-04-03", "2026-04-04"],
          temperature_2m_max: [68, 49],
          temperature_2m_min: [51, 38],
          precipitation_probability_max: [20, 72],
          precipitation_sum: [0, 0.31],
          weather_code: [2, 63],
          wind_speed_10m_max: [8, 19],
        },
      }),
    });

    const result = await getWeatherForecast(2);

    expect(result.status).toBe("ok");
    expect(result.days).toHaveLength(2);
    expect(result.days[0]).toEqual(
      expect.objectContaining({
        date: "2026-04-03",
        condition: "Partly cloudy",
        conditionKey: "cloudy",
        tempHighF: 68,
        tempLowF: 51,
        precipitationChance: 20,
        windMph: 8,
      })
    );
    expect(result.days[1]).toEqual(
      expect.objectContaining({
        date: "2026-04-04",
        condition: "Rain",
        conditionKey: "rain",
        precipitationIn: 0.31,
      })
    );
  });

  test("returns fallback messaging when location is unavailable", async () => {
    global.navigator.geolocation.getCurrentPosition = jest.fn((success, error) => error(new Error("nope")));

    const result = await getWeatherForecast(3);

    expect(result.status).toBe("fallback");
    expect(result.days).toEqual([]);
    expect(result.message).toMatch(/weather data is unavailable/i);
  });
});

describe("getDestinationWeatherForecast", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              name: "Paris",
              admin1: "Ile-de-France",
              country: "France",
              latitude: 48.85,
              longitude: 2.35,
              timezone: "Europe/Paris",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          daily: {
            time: ["2026-04-10", "2026-04-11"],
            temperature_2m_max: [61, 58],
            temperature_2m_min: [48, 46],
            precipitation_probability_max: [12, 44],
            precipitation_sum: [0, 0.08],
            weather_code: [1, 63],
            wind_speed_10m_max: [9, 12],
          },
        }),
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  test("looks up the destination and returns range-aware forecast days", async () => {
    const result = await getDestinationWeatherForecast({
      destination: "Paris",
      startDate: "2026-04-10",
      endDate: "2026-04-11",
    });

    expect(result.status).toBe("ok");
    expect(result.location).toEqual(expect.objectContaining({ label: "Paris, Ile-de-France, France" }));
    expect(result.days).toHaveLength(2);
    expect(result.days[1]).toEqual(expect.objectContaining({
      date: "2026-04-11",
      conditionKey: "rain",
      tempHighF: 58,
    }));
  });
});
