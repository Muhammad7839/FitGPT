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
import { readAccessibilityPrefs, applyAccessibilityToDocument } from "./utils/accessibilityPrefs";

const TEXT_SCALE_KEY = "fitgpt_text_scale_v1";
const HIGH_CONTRAST_KEY = "fitgpt_high_contrast_v1";
const TEXT_SCALE_LEVELS = Object.freeze({
  medium: 1,
  large: 1.08,
  xl: 1.16,
});
if (!localStorage.getItem(STALE_CLEANUP_KEY)) {
  localStorage.removeItem(WARDROBE_KEY);
  localStorage.setItem(STALE_CLEANUP_KEY, "1");
}

function loadCustomThemes() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function hasAccount() {
  return !!localStorage.getItem(TOKEN_KEY);
}

function readTheme(customThemes) {
  if (!hasAccount()) return getPresetTheme("dark");

  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) {
      const { activeThemeId } = JSON.parse(raw);
      const preset = getPresetTheme(activeThemeId);
      if (preset && preset.id === activeThemeId) return preset;
      const custom = customThemes.find((t) => t.id === activeThemeId);
      if (custom) return custom;
    }

    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark") return getPresetTheme("dark");
  } catch {}
  return getPresetTheme("light");
}

function readTextScale() {
  try {
    const raw = localStorage.getItem(TEXT_SCALE_KEY);
    if (raw && TEXT_SCALE_LEVELS[raw]) return raw;
  } catch {}
  return "medium";
}

function readHighContrast() {
  try {
    return localStorage.getItem(HIGH_CONTRAST_KEY) === "true";
  } catch {}
  return false;
}

const ThemeContext = createContext(null);
const TextScaleContext = createContext(null);
const ContrastContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export function useTextScale() {
  return useContext(TextScaleContext);
}

export function useContrastMode() {
  return useContext(ContrastContext);
}

export default function App() {
  const [customThemes, setCustomThemes] = useState(() => loadCustomThemes());
  const [activeTheme, setActiveTheme] = useState(() => readTheme(customThemes));
  const [textScale, setTextScaleState] = useState(() => readTextScale());
  const [highContrast, setHighContrastState] = useState(() => readHighContrast());

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
  useLayoutEffect(() => {
    const scale = TEXT_SCALE_LEVELS[textScale] || 1;
    document.documentElement.style.setProperty("--app-text-scale", String(scale));
    document.documentElement.setAttribute("data-text-scale", textScale);
    localStorage.setItem(TEXT_SCALE_KEY, textScale);
  }, [textScale]);

  useLayoutEffect(() => {
    if (highContrast) {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }
    localStorage.setItem(HIGH_CONTRAST_KEY, String(highContrast));
  }, [highContrast]);

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
      const fallback = hasAccount() ? "light" : "dark";
      setActiveTheme((prev) => (prev.id === themeId ? getPresetTheme(fallback) : prev));
    },
    []
  );

  const setTextScale = useCallback((nextScale) => {
    setTextScaleState(TEXT_SCALE_LEVELS[nextScale] ? nextScale : "medium");
  }, []);

  const setHighContrast = useCallback((nextValue) => {
    setHighContrastState(Boolean(nextValue));
  }, []);

  const themeValue = {
    theme: activeTheme,
    themeBase: activeTheme.base,
    setTheme,
    customThemes,
    saveCustomTheme,
    deleteCustomTheme,
    allThemes: [...PRESET_THEMES, ...customThemes],
  };

  const textScaleValue = {
    textScale,
    setTextScale,
    levels: TEXT_SCALE_LEVELS,
  };

  const contrastValue = {
    highContrast,
    setHighContrast,
  };

  return (
    <ThemeContext.Provider value={themeValue}>
      <TextScaleContext.Provider value={textScaleValue}>
        <ContrastContext.Provider value={contrastValue}>
          <AuthProvider>
            <TopNav />
            <AppRoutes />
            <Chatbot />
          </AuthProvider>
        </ContrastContext.Provider>
      </TextScaleContext.Provider>
    </ThemeContext.Provider>
  );
}
