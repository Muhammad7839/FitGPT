import { TOKEN_KEY, AUTH_MODE_KEY } from "../utils/constants";

function resolveBaseUrl() {
  const configured = (process.env.REACT_APP_API_BASE_URL || "").toString().trim();
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:8000";
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

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

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
