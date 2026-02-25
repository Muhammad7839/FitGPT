// web/src/api/apiFetch.js

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "fitgpt_token_v1";
const AUTH_MODE_KEY = "fitgpt_auth_mode_v1";

export function hasApi() {
  const base = (BASE_URL || "").toString().trim();
  return base.length > 0;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  const t = (token || "").toString().trim();
  if (!t) {
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function setAuthMode(mode) {
  const v = mode === "google" ? "google" : mode === "email" ? "email" : "guest";
  localStorage.setItem(AUTH_MODE_KEY, v);
}

function buildUrl(path) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
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
  } catch {
    // ignore
  }

  try {
    const text = await res.text();
    if (text) return text.slice(0, 300);
  } catch {
    // ignore
  }

  return `Request failed (${res.status})`;
}

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  const token = getToken();
  const headers = new Headers(options.headers || {});

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      setAuthMode("guest");
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