// web/src/App.js
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import "./App.css";

import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./auth/AuthProvider";

const THEME_KEY = "fitgpt_theme_v1";

// One-time cleanup: remove stale wardrobe data from localStorage
// that was blocking fresh sessionStorage data from being used
const STALE_CLEANUP_KEY = "fitgpt_stale_cleanup_v2";
if (!localStorage.getItem(STALE_CLEANUP_KEY)) {
  localStorage.removeItem("fitgpt_wardrobe_v1");
  localStorage.setItem(STALE_CLEANUP_KEY, "1");
}

function readTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark") return "dark";
  } catch {}
  return "light";
}

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

function FloatingThemeToggle({ theme, onToggle }) {
  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    if (animating) return;
    setAnimating(true);

    const next = theme === "light" ? "dark" : "light";
    const overlay = document.createElement("div");
    overlay.className = "themeWaterfallOverlay " + (next === "dark" ? "toDark" : "toLight");
    document.body.appendChild(overlay);

    setTimeout(() => onToggle(), 300);
    setTimeout(() => overlay.classList.add("done"), 380);
    setTimeout(() => {
      overlay.remove();
      setAnimating(false);
    }, 720);
  };

  return (
    <button
      type="button"
      className={"globalThemeToggle" + (theme === "dark" ? " dark" : "")}
      onClick={handleToggle}
      disabled={animating}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      <span className="globalThemeLabel">
        {theme === "light" ? "Light" : "Dark"}
      </span>
      <span className="globalThemeTrack">
        <span className="globalThemeThumb">
          {theme === "light" ? "\u2600" : "\u263E"}
        </span>
      </span>
    </button>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => readTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === "light" ? "dark" : "light")), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <AuthProvider>
        <AppRoutes />
        <FloatingThemeToggle theme={theme} onToggle={toggleTheme} />
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
