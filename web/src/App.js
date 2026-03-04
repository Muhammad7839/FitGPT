// web/src/App.js
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import "./App.css";

import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./auth/AuthProvider";
import { getPresetTheme, PRESET_THEMES } from "./theme/themeDefinitions";
import { applyTheme } from "./theme/themeEngine";
import TopNav from "./components/TopNav";

const LEGACY_THEME_KEY = "fitgpt_theme_v1";
const THEME_KEY = "fitgpt_theme_v2";
const CUSTOM_THEMES_KEY = "fitgpt_custom_themes_v1";

// One-time cleanup: remove stale wardrobe data from localStorage
// that was blocking fresh sessionStorage data from being used
const STALE_CLEANUP_KEY = "fitgpt_stale_cleanup_v2";
if (!localStorage.getItem(STALE_CLEANUP_KEY)) {
  localStorage.removeItem("fitgpt_wardrobe_v1");
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

/** Read the active theme, migrating from v1 if needed */
function readTheme(customThemes) {
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

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(activeTheme);
    localStorage.setItem(THEME_KEY, JSON.stringify({ activeThemeId: activeTheme.id }));
  }, [activeTheme]);

  const setTheme = useCallback(
    (themeOrId) => {
      const theme =
        typeof themeOrId === "string"
          ? getPresetTheme(themeOrId) ||
            customThemes.find((t) => t.id === themeOrId) ||
            getPresetTheme("light")
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
      // If the deleted theme was active, fall back to classic
      setActiveTheme((prev) => (prev.id === themeId ? getPresetTheme("light") : prev));
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
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
