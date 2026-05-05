import { AUTH_MODE_KEY, TOKEN_KEY } from "../utils/constants";
import { apiFetch, clearToken, setToken, setUnauthorizedHandler } from "./apiFetch";

describe("apiFetch", () => {
  const originalWindowLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    clearToken();
    setUnauthorizedHandler(null);
    jest.resetAllMocks();
    delete global.fetch;
    delete process.env.REACT_APP_API_LAN_BASE_URL;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalWindowLocation,
    });
    jest.useRealTimers();
  });

  test("attaches the bearer token and returns parsed json", async () => {
    setToken("session-token");
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });

    const result = await apiFetch("/me", { method: "GET" });
    const [, request] = global.fetch.mock.calls[0];

    expect(result).toEqual({ ok: true });
    expect(request.headers.get("Authorization")).toBe("Bearer session-token");
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(request.credentials).toBe("include");
  });

  test("clears auth state and invokes the unauthorized handler on 401", async () => {
    const unauthorizedHandler = jest.fn();
    setToken("expired-token");
    localStorage.setItem(AUTH_MODE_KEY, "email");
    setUnauthorizedHandler(unauthorizedHandler);
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "Expired token" }),
      text: async () => "",
    });

    await expect(apiFetch("/me", { method: "GET" })).rejects.toMatchObject({
      message: "Expired token",
      status: 401,
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem(AUTH_MODE_KEY)).toBe("guest");
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
  });

  test("does not force a json content-type when sending form data", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["image"], { type: "text/plain" }), "item.txt");
    global.fetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => "" },
    });

    const result = await apiFetch("/wardrobe/items/upload", {
      method: "POST",
      body: formData,
    });
    const [, request] = global.fetch.mock.calls[0];

    expect(result).toBeNull();
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  test("uses the deployed backend URL when running on a non-local host", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "fitgpt.tech" },
    });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });

    await apiFetch("/me", { method: "GET" });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("https://fitgpt-backend-tdiq.onrender.com/me");
  });

  test("uses the current LAN host for private-network development", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "192.168.1.24", protocol: "http:" },
    });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });

    await apiFetch("/me", { method: "GET" });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("http://192.168.1.24:8000/me");
  });

  test("prefers the configured LAN API base URL for private-network development", async () => {
    process.env.REACT_APP_API_LAN_BASE_URL = "http://192.168.1.50:9000";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "192.168.1.24", protocol: "http:" },
    });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });

    await apiFetch("/me", { method: "GET" });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("http://192.168.1.50:9000/me");
  });

  test("normalizes backend timeouts into an explicit error", async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementation((_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    }));

    const pending = apiFetch("/slow", { method: "GET" });
    jest.advanceTimersByTime(60000);

    await expect(pending).rejects.toMatchObject({
      message: "Request timed out. Please try again.",
      code: "request_timeout",
    });
  });

  test("normalizes network failures into an explicit error", async () => {
    global.fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/me", { method: "GET" })).rejects.toMatchObject({
      message: "Network request failed. Check your connection and backend.",
      code: "network_error",
    });
  });
});
