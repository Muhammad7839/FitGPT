import { TOKEN_KEY, AUTH_MODE_KEY } from "../utils/constants";

/**
 * JWT access tokens are stored in localStorage so the SPA can attach Authorization headers
 * on fetch calls without a same-origin cookie round-trip. Tradeoff: any XSS could read tokens;
 * httpOnly cookies avoid that but require same-site backend routing and CSRF protections.
 */

const REQUEST_TIMEOUT_MS = 15000;
const REFRESH_TOKEN_KEY = "fitgpt_refresh_token_v1";

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

  return "https://fitgpt-backend-tdiq.onrender.com";
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

/**
 * Resolve a possibly-relative image URL to a fully-qualified URL.
 * Backend stores images as /uploads/<filename> which must be served from
 * the backend origin, not the frontend origin.
 */
export function resolveImageUrl(url) {
  if (!url) return url;
  const s = url.toString().trim();
  if (s.startsWith("/uploads/")) {
    const base = resolveBaseUrl().replace(/\/$/, "");
    return `${base}${s}`;
  }
  return s;
}

function getToken() {
  return (
    localStorage.getItem("fitgpt_token_v1") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

export function hasStoredToken() {
  return Boolean(getToken());
}

export function usesCookieAuth() {
  return USE_COOKIES;
}

export function setToken(token) {
  const t = (token || "").toString().trim();
  if (!t) {
    localStorage.removeItem("access_token");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem("access_token", t);
  localStorage.setItem(TOKEN_KEY, t);
}

export function setRefreshToken(token) {
  const t = (token || "").toString().trim();
  if (!t) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, t);
}

export function clearToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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

function _sanitizeApiErrorText(status, rawText) {
  if (status >= 500) return "Something went wrong. Please try again.";
  const text = (rawText || "").toString();
  if (
    status >= 400 &&
    (/\btraceback\b|\bexception\b|\bat\s+0x|\n\s+File "/i.test(text) || text.length > 400)
  ) {
    return "Something went wrong. Please try again.";
  }
  return text.slice(0, 300);
}

async function readErrorMessage(res) {
  const status = res.status;
  if (status >= 500) {
    try {
      await res.text();
    } catch {}
    return "Something went wrong. Please try again.";
  }

  try {
    const data = await res.json();
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return _sanitizeApiErrorText(status, data.detail.trim());
    }
    // Pydantic 422: detail is an array of {loc, msg, type} objects
    if (Array.isArray(data?.detail)) {
      const msgs = data.detail
        .map((e) => (typeof e?.msg === "string" ? e.msg.trim() : null))
        .filter(Boolean);
      if (msgs.length) return msgs.join(". ");
    }
    if (typeof data?.message === "string") return _sanitizeApiErrorText(status, data.message);
    if (typeof data?.error === "string") return _sanitizeApiErrorText(status, data.error);
  } catch {}

  try {
    const text = await res.text();
    if (text) return _sanitizeApiErrorText(status, text);
  } catch {}

  return `Request failed (${status})`;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;
    const accessToken = (data?.access_token || data?.token || "").toString().trim();
    if (!accessToken) return false;
    setToken(accessToken);
    const nextRefresh = (data?.refresh_token || "").toString().trim();
    if (nextRefresh) setRefreshToken(nextRefresh);
    return true;
  } catch {
    return false;
  }
}

function handleUnauthorized() {
  if (!USE_COOKIES) clearToken();
  setAuthMode("guest");
  if (onUnauthorized) onUnauthorized();
  if (typeof window !== "undefined" && window.location?.pathname !== "/login") {
    try {
      window.location.assign("/login");
    } catch {}
  }
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs, skipAuthRefresh = false, ...fetchOptions } = options;
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
      const canRefresh = !USE_COOKIES && !skipAuthRefresh && path !== "/auth/refresh";
      if (canRefresh && await refreshAccessToken()) {
        return apiFetch(path, { ...options, skipAuthRefresh: true });
      }
      handleUnauthorized();
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

const _offlineListeners = new Set();
let _offlineListenersInstalled = false;

function _notifyOfflineSubscribers(online) {
  _offlineListeners.forEach((fn) => {
    try {
      fn(online);
    } catch {}
  });
}

function _ensureOfflineWindowListeners() {
  if (_offlineListenersInstalled || typeof window === "undefined") return;
  _offlineListenersInstalled = true;
  window.addEventListener("online", () => _notifyOfflineSubscribers(true));
  window.addEventListener("offline", () => _notifyOfflineSubscribers(false));
}

/** Subscribe to browser online/offline (detaches when callback returns cleanup). */
export function subscribeOnlineStatus(callback) {
  if (typeof callback !== "function") return () => {};
  _ensureOfflineWindowListeners();
  _offlineListeners.add(callback);
  try {
    callback(typeof navigator !== "undefined" ? navigator.onLine : true);
  } catch {}
  return () => {
    _offlineListeners.delete(callback);
  };
}
