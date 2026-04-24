// web/src/App.js
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import "./App.css";

import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./auth/AuthProvider";
import { getPresetTheme, PRESET_THEMES } from "./theme/themeDefinitions";
import { applyTheme } from "./theme/themeEngine";
import TopNav from "./components/TopNav";
import Chatbot from "./components/Chatbot";
import { LEGACY_THEME_KEY, THEME_KEY, CUSTOM_THEMES_KEY, STALE_CLEANUP_KEY, TOKEN_KEY, WARDROBE_KEY, EVT_ACCESSIBILITY_CHANGED } from "./utils/constants";
import { applyAccessibilityToDocument, readAccessibilityPrefs } from "./utils/accessibilityPrefs";
if (!localStorage.getItem(STALE_CLEANUP_KEY)) {
  localStorage.removeItem(WARDROBE_KEY);
  localStorage.setItem(STALE_CLEANUP_KEY, "1");
}

/** Load custom themes from localStorage */
function loadCustomThemes() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/** Check whether the user has a saved account (JWT token present) */
function hasAccount() {
  return !!localStorage.getItem(TOKEN_KEY);
}

/** Read the active theme, migrating from v1 if needed.
 *  Guests always default to dark; persisted theme only loads for accounts. */
function readTheme(customThemes) {
  if (!hasAccount()) return getPresetTheme("dark");

  try {
    // Try v2 first
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const { activeThemeId } = JSON.parse(raw);
      // Check presets
      const preset = getPresetTheme(activeThemeId);
      if (preset && preset.id === activeThemeId) return preset;
      // Check custom themes
      const custom = customThemes.find((t) => t.id === activeThemeId);
      if (custom) return custom;
    }

    // Migrate from v1 ("light" / "dark")
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark") return getPresetTheme("dark");
  } catch {}
  return getPresetTheme("light");
}

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export default function App() {
  const [customThemes, setCustomThemes] = useState(() => loadCustomThemes());
  const [activeTheme, setActiveTheme] = useState(() => readTheme(customThemes));

  // Apply theme whenever it changes — useLayoutEffect to prevent light-mode flash
  // Only persist to localStorage for signed-in users; guests get dark by default each session
  useLayoutEffect(() => {
    applyTheme(activeTheme);
    if (hasAccount()) {
      localStorage.setItem(THEME_KEY, JSON.stringify({ activeThemeId: activeTheme.id }));
    }
  }, [activeTheme]);

  useEffect(() => {
    applyAccessibilityToDocument(readAccessibilityPrefs(null));
    const onChange = () => applyAccessibilityToDocument(readAccessibilityPrefs(null));
    window.addEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
    return () => window.removeEventListener(EVT_ACCESSIBILITY_CHANGED, onChange);
  }, []);

  const setTheme = useCallback(
    (themeOrId) => {
      const theme =
        typeof themeOrId === "string"
          ? getPresetTheme(themeOrId) ||
            customThemes.find((t) => t.id === themeOrId) ||
            getPresetTheme(hasAccount() ? "light" : "dark")
          : themeOrId;
      setActiveTheme(theme);
    },
    [customThemes]
  );

  const saveCustomTheme = useCallback((theme) => {
    setCustomThemes((prev) => {
      const idx = prev.findIndex((t) => t.id === theme.id);
      const next = idx >= 0 ? prev.map((t, i) => (i === idx ? theme : t)) : [...prev.slice(0, 4), theme];
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteCustomTheme = useCallback(
    (themeId) => {
      setCustomThemes((prev) => {
        const next = prev.filter((t) => t.id !== themeId);
        localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
        return next;
      });
      // If the deleted theme was active, fall back to default
      const fallback = hasAccount() ? "light" : "dark";
      setActiveTheme((prev) => (prev.id === themeId ? getPresetTheme(fallback) : prev));
    },
    []
  );

  const ctxValue = {
    theme: activeTheme,
    themeBase: activeTheme.base,
    setTheme,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
    allThemes: [...PRESET_THEMES, ...customThemes],
  };

  return (
    <ThemeContext.Provider value={ctxValue}>
      <AuthProvider>
        <TopNav />
        <AppRoutes />
        <Chatbot />
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
