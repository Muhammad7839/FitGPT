
import { apiFetch, setToken, clearToken, markSignedInEmail, markGuest, hasApi } from "./apiFetch";

const AUTH_ENDPOINTS = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};

function extractToken(data) {
  if (!data) return "";
  if (typeof data === "string") return data;

  const candidates = [
    data.access_token,
    data.token,
    data.jwt,
    data.accessToken,
    data.auth_token,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  if (typeof data?.data?.access_token === "string") return data.data.access_token.trim();
  if (typeof data?.data?.token === "string") return data.data.token.trim();

  return "";
}

export async function login(email, password) {
  if (!hasApi()) throw new Error("API base URL is missing.");

  const payload = { email, password };

  const data = await apiFetch(AUTH_ENDPOINTS.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const token = extractToken(data);
  if (!token) throw new Error("Login succeeded but no token was returned by the API.");

  setToken(token);
  markSignedInEmail();
  return { token, raw: data };
}


export async function loginWithEmail(email, password) {
  return login(email, password);
}

export async function register(email, password) {
  if (!hasApi()) throw new Error("API base URL is missing.");

  const payload = { email, password };
  return apiFetch(AUTH_ENDPOINTS.register, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export async function registerWithEmail(email, password) {
  return register(email, password);
}

export async function logout() {
  clearToken();
  markGuest();
}

export async function getMe() {
  if (!hasApi()) throw new Error("API base URL is missing.");
  return apiFetch(AUTH_ENDPOINTS.me, { method: "GET" });
}