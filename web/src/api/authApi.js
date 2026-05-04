/**
 * Auth responses persist JWT access + refresh tokens via apiFetch/localStorage (see apiFetch.js).
 * Changing to httpOnly cookies would require coordinated backend CORS, CSRF, and refresh flows.
 */
import {
    apiFetch,
    setToken,
    setRefreshToken,
    clearToken,
    markSignedInEmail,
    markGuest,
    hasApi,
  } from "./apiFetch";
  
  const AUTH_STRATEGY = (process.env.REACT_APP_AUTH_STRATEGY || "token").toLowerCase();
  const USE_COOKIES = AUTH_STRATEGY === "cookies";
  
  const AUTH_ENDPOINTS_PRIMARY = {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
  };
  
  const AUTH_ENDPOINTS_FALLBACK = {
    login: "/login",
    register: "/register",
    me: "/me",
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

  function extractRefreshToken(data) {
    if (!data || typeof data === "string") return "";

    const candidates = [
      data.refresh_token,
      data.refreshToken,
      data.refresh,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }

    if (typeof data?.data?.refresh_token === "string") return data.data.refresh_token.trim();
    if (typeof data?.data?.refreshToken === "string") return data.data.refreshToken.trim();

    return "";
  }
  
  function isNotFoundError(err) {
    return err && (err.status === 404 || err.status === 405);
  }
  
  async function callWithFallback(primaryPath, fallbackPath, options) {
    try {
      return await apiFetch(primaryPath, options);
    } catch (err) {
      if (isNotFoundError(err) && fallbackPath && fallbackPath !== primaryPath) {
        return apiFetch(fallbackPath, options);
      }
      throw err;
    }
  }
  
  export async function login(email, password) {
    if (!hasApi()) throw new Error("API base URL is missing.");
  
    const payload = { email, password };
  
    const data = await callWithFallback(
      AUTH_ENDPOINTS_PRIMARY.login,
      AUTH_ENDPOINTS_FALLBACK.login,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  
    const token = extractToken(data);
    const refreshToken = extractRefreshToken(data);
  
    if (!USE_COOKIES) {
      if (!token) throw new Error("Login succeeded but no token was returned by the API.");
      setToken(token);
      setRefreshToken(refreshToken);
    } else {
      if (token) setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
    }
  
    markSignedInEmail();
    return { token: token || "", raw: data };
  }
  
  export async function loginWithEmail(email, password) {
    return login(email, password);
  }
  
  export async function register(email, password) {
    if (!hasApi()) throw new Error("API base URL is missing.");
  
    const payload = { email, password };
  
    return callWithFallback(
      AUTH_ENDPOINTS_PRIMARY.register,
      AUTH_ENDPOINTS_FALLBACK.register,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }
  
  export async function registerWithEmail(email, password) {
    return register(email, password);
  }

  export async function verifyEmail(token) {
    if (!hasApi()) throw new Error("API base URL is missing.");
    const encoded = encodeURIComponent((token || "").toString().trim());
    return apiFetch(`/auth/verify-email?token=${encoded}`, { method: "GET" });
  }

  export async function resendVerificationEmail() {
    if (!hasApi()) throw new Error("API base URL is missing.");
    return apiFetch("/auth/resend-verification", { method: "POST" });
  }
  
  export async function loginWithGoogle(idToken) {
    if (!hasApi()) throw new Error("API base URL is missing.");

    const data = await callWithFallback(
      "/auth/google/callback",
      "/google/callback",
      {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      }
    );

    const token = extractToken(data);
    const refreshToken = extractRefreshToken(data);

    if (!USE_COOKIES) {
      if (!token) throw new Error("Google login succeeded but no token was returned.");
      setToken(token);
      setRefreshToken(refreshToken);
    } else {
      if (token) setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);
    }

    markSignedInEmail();
    return { token: token || "", raw: data };
  }

  export async function logout() {
    try {
      await apiFetch("/logout", { method: "POST" });
    } catch {}
  
    clearToken();
    markGuest();
  }
  
  export async function getMe() {
    if (!hasApi()) throw new Error("API base URL is missing.");
  
    return callWithFallback(
      AUTH_ENDPOINTS_PRIMARY.me,
      AUTH_ENDPOINTS_FALLBACK.me,
      { method: "GET" }
    );
  }

  export async function refreshToken(refreshToken) {
    if (!hasApi()) throw new Error("API base URL is missing.");

    return apiFetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      skipAuthRefresh: true,
    });
  }
