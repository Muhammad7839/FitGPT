import { TOKEN_KEY, AUTH_MODE_KEY } from "../utils/constants";

const REQUEST_TIMEOUT_MS = 15000;

function isPrivateNetworkHost(hostname) {
  return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname.endsWith(".local");
}

function resolveBaseUrl() {
  const configured = (process.env.REACT_APP_API_BASE_URL || "").toString().trim();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const configuredLan = (process.env.REACT_APP_API_LAN_BASE_URL || "").toString().trim();
    const { hostname, protocol } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
    if (isPrivateNetworkHost(hostname)) {
      return configuredLan || `${protocol === "https:" ? "https" : "http"}://${hostname}:8000`;
    }
  }

  return "";
}

const AUTH_STRATEGY = (process.env.REACT_APP_AUTH_STRATEGY || "token").toLowerCase();
const USE_COOKIES = AUTH_STRATEGY === "cookies";

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = typeof fn === "function" ? fn : null;
}

export function hasApi() {
  const base = resolveBaseUrl();
  return base.length > 0 || typeof window !== "undefined";
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
  const baseUrl = resolveBaseUrl();
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
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

export async function apiFetch(path, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const url = buildUrl(path);
  const token = getToken();
  const headers = new Headers(fetchOptions.headers || {});
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const externalSignal = fetchOptions.signal;
  let timeoutId = null;
  let didTimeout = false;
  let removeExternalAbortListener = null;
  const requestTimeoutMs =
    Number.isFinite(timeoutMs) && Number(timeoutMs) > 0 ? Number(timeoutMs) : REQUEST_TIMEOUT_MS;

  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!USE_COOKIES && token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (controller) {
    if (externalSignal?.aborted) {
      controller.abort(externalSignal.reason);
    } else if (externalSignal?.addEventListener) {
      const abortFromExternalSignal = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
      removeExternalAbortListener = () => {
        externalSignal.removeEventListener("abort", abortFromExternalSignal);
      };
    }

    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, requestTimeoutMs);
  }

  let res;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
      signal: controller?.signal || externalSignal,
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    removeExternalAbortListener?.();

    if (didTimeout) {
      const timeoutError = new Error("Request timed out. Please try again.");
      timeoutError.code = "request_timeout";
      throw timeoutError;
    }

    if (error?.name === "AbortError") {
      const abortError = new Error("Request was cancelled.");
      abortError.code = "request_aborted";
      throw abortError;
    }

    const networkError = new Error("Network request failed. Check your connection and backend.");
    networkError.code = "network_error";
    throw networkError;
  }

  if (timeoutId) clearTimeout(timeoutId);
  removeExternalAbortListener?.();

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
