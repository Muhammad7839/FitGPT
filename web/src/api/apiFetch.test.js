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
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalWindowLocation,
    });
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

  test("uses a relative path when no production API env is configured", async () => {
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
    expect(url).toBe("/me");
  });
});
