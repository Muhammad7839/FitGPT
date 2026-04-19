import { TOKEN_KEY, AUTH_MODE_KEY } from "../utils/constants";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "https://fitgpt-backend-tdiq.onrender.com").trim();

const AUTH_STRATEGY = (process.env.REACT_APP_AUTH_STRATEGY || "token").toLowerCase();
const USE_COOKIES = AUTH_STRATEGY === "cookies";

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = typeof fn === "function" ? fn : null;
}

export function hasApi() {
  const base = (BASE_URL || "").toString().trim();
  return base.length > 0;
}

function getToken() {
  return (
    localStorage.getItem("fitgpt_token_v1") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

export function setToken(token) {
  const t = (token || "").toString().trim();
  if (!t) {
    localStorage.removeItem("access_token");
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem("access_token", t);
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem(TOKEN_KEY);
}

function setAuthMode(mode) {
  const v = mode === "google" ? "google" : mode === "email" ? "email" : "guest";
  localStorage.setItem(AUTH_MODE_KEY, v);
}

function buildUrl(path) {
  const trimmed = BASE_URL.trim();
  const base = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  if (!path) return base;
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
  } catch {}

  try {
    const text = await res.text();
    if (text) return text.slice(0, 300);
  } catch {}

  return `Request failed (${res.status})`;
}

const DEFAULT_TIMEOUT_MS = 15000;

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  const token = getToken();
  const headers = new Headers(options.headers || {});

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!USE_COOKIES && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(new Error("timeout")), timeoutMs)
    : null;
  if (callerSignal && controller) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), { once: true });
  }

  let res;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
      signal: controller ? controller.signal : callerSignal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      const abortErr = new Error("Request timed out. Check your connection and try again.");
      abortErr.status = 0;
      abortErr.isTimeout = true;
      throw abortErr;
    }
    const netErr = new Error("Network error: could not reach the server.");
    netErr.status = 0;
    netErr.isNetwork = true;
    netErr.cause = err;
    throw netErr;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (!USE_COOKIES) clearToken();
      setAuthMode("guest");
      if (onUnauthorized) onUnauthorized();
    }

    const msg = await readErrorMessage(res);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export function markSignedInEmail() {
  setAuthMode("email");
}

export function markGuest() {
  setAuthMode("guest");
}
