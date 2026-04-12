import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe } from "../api/authApi";
import { setUnauthorizedHandler } from "../api/apiFetch";
import { migrateGuestData } from "../utils/userStorage";

const AuthContext = createContext(null);

function looksLikeUser(data) {
  if (!data) return false;
  if (typeof data !== "object") return false;

  const u = data.user && typeof data.user === "object" ? data.user : data;

  return Boolean(
    u.id ||
      u.user_id ||
      u.email ||
      u.username ||
      u.name ||
      (u.ok === true && (u.email || u.id))
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  useEffect(() => {
    let alive = true;

    async function checkSession() {
      try {
        const data = await getMe();

        if (!alive) return;

        if (looksLikeUser(data)) {
          const resolved = data.user || data;
          migrateGuestData(resolved);
          setUser(resolved);
        } else {
          setUser(null);
        }
      } catch {
        if (!alive) return;
        setUser(null);
      } finally {
        if (!alive) return;
        setIsChecking(false);
      }
    }

    checkSession();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => ({ user, setUser, isChecking }), [user, isChecking]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}