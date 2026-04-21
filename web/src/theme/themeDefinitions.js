// web/src/theme/themeDefinitions.js
import { deriveAccentVars, withAlpha } from "./colorUtils";

/**
 * Build a complete theme vars object from a minimal spec.
 * Only accent + bg + text + surface are required; everything else is derived.
 */
function buildVars(base, accent, overrides = {}) {
  const isLight = base === "light";

  // Derive accent family from single hex
  const accentVars = deriveAccentVars(accent, base);

  // Base vars (non-accent)
  const baseVars = isLight
    ? {
        "--bg": "#ffffff",
        "--text": "#111111",
        "--muted": "rgba(17, 17, 17, 0.62)",
        "--border": "rgba(17, 24, 39, 0.10)",
        "--bgSoft": "rgba(0, 0, 0, 0.04)",
        "--shadow": "0 16px 44px rgba(17, 24, 39, 0.10)",
        "--shadow-hover": "0 20px 60px rgba(17, 24, 39, 0.14)",
        "--pageBg1": "#fbf7f7",
        "--pageBg2": "#ffffff",
        "--surface": "#ffffff",
        "--surface-input": "#ffffff",
        "--surface-border": "rgba(17, 24, 39, 0.10)",
        "--wardrobe-blue": "#2563eb",
        "--wardrobe-blue-soft": "rgba(37, 99, 235, 0.08)",
      }
    : {
        "--bg": "#141418",
        "--text": "#e8e6e3",
        "--muted": "rgba(232, 230, 227, 0.55)",
        "--border": "rgba(255, 255, 255, 0.08)",
        "--bgSoft": "rgba(255, 255, 255, 0.04)",
        "--shadow": "0 16px 44px rgba(0, 0, 0, 0.35)",
        "--shadow-hover": "0 20px 60px rgba(0, 0, 0, 0.45)",
        "--pageBg1": "#0e0e12",
        "--pageBg2": "#141418",
        "--surface": "#1c1c22",
        "--surface-input": "rgba(28, 28, 34, 0.92)",
        "--surface-border": "rgba(255, 255, 255, 0.06)",
        "--wardrobe-blue": "#5b8def",
        "--wardrobe-blue-soft": "rgba(91, 141, 239, 0.12)",
      };

  return { ...baseVars, "--accent": accent, ...accentVars, ...overrides };
}

// ── Preset Themes ───────────────────────────────────────────

export const PRESET_THEMES = [
  // Classic
  {
    id: "light",
    name: "Classic Light",
    base: "light",
    category: "classic",
    icon: "\u2600\uFE0F",
    vars: buildVars("light", "#8b1e1e"),
  },
  {
    id: "dark",
    name: "Classic Dark",
    base: "dark",
    category: "classic",
    icon: "\uD83C\uDF19",
    vars: buildVars("dark", "#c43c3c"),
  },

  // Editorial — cream paper aesthetic, serif-friendly, ink burgundy accent.
  // Used by the magazine-style Dashboard hero. Opt-in only.
  {
    id: "editorial",
    name: "Editorial Paper",
    base: "light",
    category: "preset",
    icon: "\uD83D\uDCD6",
    vars: buildVars("light", "#7a1f1f", {
      "--bg": "#f5efe6",
      "--pageBg1": "#f0e8db",
      "--pageBg2": "#f7f1e8",
      "--surface": "#fbf6ee",
      "--surface-input": "#fbf6ee",
      "--surface-border": "rgba(38, 28, 20, 0.14)",
      "--text": "#2a221c",
      "--muted": "rgba(42, 34, 28, 0.6)",
      "--border": "rgba(38, 28, 20, 0.14)",
      "--bgSoft": "rgba(38, 28, 20, 0.05)",
      "--shadow": "0 14px 38px rgba(38, 28, 20, 0.12)",
      "--shadow-hover": "0 18px 50px rgba(38, 28, 20, 0.18)",
      "--wardrobe-blue": "#7a1f1f",
      "--wardrobe-blue-soft": "rgba(122, 31, 31, 0.08)",
    }),
  },

  // Color presets
  {
    id: "ocean",
    name: "Ocean Breeze",
    base: "light",
    category: "preset",
    icon: "\uD83C\uDF0A",
    vars: buildVars("light", "#0d7377", {
      "--bg": "#f5fafa",
      "--pageBg1": "#eef7f7",
      "--pageBg2": "#f5fafa",
      "--wardrobe-blue": "#0891b2",
      "--wardrobe-blue-soft": "rgba(8, 145, 178, 0.08)",
    }),
  },
  {
    id: "sunset",
    name: "Golden Sunset",
    base: "light",
    category: "preset",
    icon: "\uD83C\uDF05",
    vars: buildVars("light", "#c2410c", {
      "--bg": "#fffbf5",
      "--pageBg1": "#fef3e2",
      "--pageBg2": "#fffbf5",
      "--wardrobe-blue": "#d97706",
      "--wardrobe-blue-soft": "rgba(217, 119, 6, 0.08)",
    }),
  },
  {
    id: "forest",
    name: "Emerald Forest",
    base: "dark",
    category: "preset",
    icon: "\uD83C\uDF32",
    vars: buildVars("dark", "#059669", {
      "--bg": "#0f1a16",
      "--pageBg1": "#0a1210",
      "--pageBg2": "#0f1a16",
      "--surface": "#152620",
      "--surface-input": "rgba(21, 38, 32, 0.92)",
      "--wardrobe-blue": "#34d399",
      "--wardrobe-blue-soft": "rgba(52, 211, 153, 0.12)",
    }),
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    base: "dark",
    category: "preset",
    icon: "\uD83C\uDF03",
    vars: buildVars("dark", "#3b82f6", {
      "--bg": "#0c1222",
      "--pageBg1": "#080e1a",
      "--pageBg2": "#0c1222",
      "--surface": "#162032",
      "--surface-input": "rgba(22, 32, 50, 0.92)",
      "--wardrobe-blue": "#60a5fa",
      "--wardrobe-blue-soft": "rgba(96, 165, 250, 0.12)",
    }),
  },

  // Seasonal / Mood
  {
    id: "spring",
    name: "Spring Pastel",
    base: "light",
    category: "seasonal",
    icon: "\uD83C\uDF38",
    vars: buildVars("light", "#8b5cf6", {
      "--bg": "#fdf5ff",
      "--pageBg1": "#f8eaff",
      "--pageBg2": "#fdf5ff",
      "--wardrobe-blue": "#a78bfa",
      "--wardrobe-blue-soft": "rgba(167, 139, 250, 0.08)",
    }),
  },
  {
    id: "autumn",
    name: "Cozy Autumn",
    base: "dark",
    category: "seasonal",
    icon: "\uD83C\uDF42",
    vars: buildVars("dark", "#d97706", {
      "--bg": "#1a1510",
      "--pageBg1": "#14100a",
      "--pageBg2": "#1a1510",
      "--surface": "#261e14",
      "--surface-input": "rgba(38, 30, 20, 0.92)",
      "--wardrobe-blue": "#fbbf24",
      "--wardrobe-blue-soft": "rgba(251, 191, 36, 0.12)",
    }),
  },
  {
    id: "cyberpunk",
    name: "Neon Cyberpunk",
    base: "dark",
    category: "seasonal",
    icon: "\u26A1",
    vars: buildVars("dark", "#ec4899", {
      "--bg": "#0a0a0f",
      "--pageBg1": "#060608",
      "--pageBg2": "#0a0a0f",
      "--surface": "#14141e",
      "--surface-input": "rgba(20, 20, 30, 0.92)",
      "--wardrobe-blue": "#06b6d4",
      "--wardrobe-blue-soft": "rgba(6, 182, 212, 0.12)",
    }),
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    base: "dark",
    category: "seasonal",
    icon: "\uD83D\uDC9C",
    vars: buildVars("dark", "#a78bfa", {
      "--bg": "#141220",
      "--pageBg1": "#0e0c18",
      "--pageBg2": "#141220",
      "--surface": "#1e1a2e",
      "--surface-input": "rgba(30, 26, 46, 0.92)",
      "--wardrobe-blue": "#c4b5fd",
      "--wardrobe-blue-soft": "rgba(196, 181, 253, 0.12)",
    }),
  },
  {
    id: "contrast-light",
    name: "High Contrast Light",
    base: "light",
    category: "accessibility",
    icon: "\u25D1",
    highContrast: true,
    vars: {
      ...buildVars("light", "#000000", {
        "--bg": "#ffffff",
        "--pageBg1": "#ffffff",
        "--pageBg2": "#ffffff",
        "--surface": "#ffffff",
        "--surface-input": "#ffffff",
        "--text": "#000000",
        "--muted": "#1a1a1a",
        "--border": "#000000",
        "--bgSoft": "#f5f5f5",
        "--surface-border": "#000000",
        "--shadow": "0 0 0 2px #000000",
        "--shadow-hover": "0 0 0 3px #000000",
        "--wardrobe-blue": "#0037ff",
        "--wardrobe-blue-soft": "rgba(0, 55, 255, 0.14)",
      }),
    },
  },
  {
    id: "contrast-dark",
    name: "High Contrast Dark",
    base: "dark",
    category: "accessibility",
    icon: "\u25D0",
    highContrast: true,
    vars: {
      ...buildVars("dark", "#ffff00", {
        "--bg": "#000000",
        "--pageBg1": "#000000",
        "--pageBg2": "#000000",
        "--surface": "#050505",
        "--surface-input": "#050505",
        "--text": "#ffffff",
        "--muted": "#f0f0f0",
        "--border": "#ffffff",
        "--bgSoft": "#1a1a1a",
        "--surface-border": "#ffffff",
        "--shadow": "0 0 0 2px #ffffff",
        "--shadow-hover": "0 0 0 3px #ffffff",
        "--wardrobe-blue": "#80e0ff",
        "--wardrobe-blue-soft": "rgba(128, 224, 255, 0.18)",
      }),
    },
  },
];

/** Lookup a preset theme by ID */
export function getPresetTheme(id) {
  return PRESET_THEMES.find((t) => t.id === id) || PRESET_THEMES[0];
}

export function isHighContrast(theme) {
  return !!(theme && theme.highContrast);
}

/** Get themes grouped by category */
export function getThemesByCategory() {
  const groups = {};
  for (const t of PRESET_THEMES) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
}

/**
 * Build a custom theme object from user inputs.
 * accent, bg, text, surface are hex strings; base is "light"|"dark".
 */
export function buildCustomTheme({ id, name, base, accent, bg, text, surface, advancedOverrides }) {
  const accentVars = deriveAccentVars(accent, base);
  const isLight = base === "light";

  const vars = {
    ...(isLight
      ? {
          "--muted": "rgba(17, 17, 17, 0.62)",
          "--border": "rgba(17, 24, 39, 0.10)",
          "--bgSoft": "rgba(0, 0, 0, 0.04)",
          "--shadow": "0 16px 44px rgba(17, 24, 39, 0.10)",
          "--shadow-hover": "0 20px 60px rgba(17, 24, 39, 0.14)",
          "--surface-input": surface || "#ffffff",
          "--surface-border": "rgba(17, 24, 39, 0.10)",
          "--wardrobe-blue": "#2563eb",
          "--wardrobe-blue-soft": "rgba(37, 99, 235, 0.08)",
        }
      : {
          "--muted": withAlpha(text || "#e8e6e3", 0.55),
          "--border": "rgba(255, 255, 255, 0.08)",
          "--bgSoft": "rgba(255, 255, 255, 0.04)",
          "--shadow": "0 16px 44px rgba(0, 0, 0, 0.35)",
          "--shadow-hover": "0 20px 60px rgba(0, 0, 0, 0.45)",
          "--surface-input": surface ? withAlpha(surface, 0.92) : "rgba(28, 28, 34, 0.92)",
          "--surface-border": "rgba(255, 255, 255, 0.06)",
          "--wardrobe-blue": "#5b8def",
          "--wardrobe-blue-soft": "rgba(91, 141, 239, 0.12)",
        }),
    "--accent": accent,
    "--bg": bg,
    "--text": text || (isLight ? "#111111" : "#e8e6e3"),
    "--surface": surface || (isLight ? "#ffffff" : "#1c1c22"),
    "--pageBg1": bg,
    "--pageBg2": bg,
    ...accentVars,
    ...(advancedOverrides || {}),
  };

  return {
    id,
    name: name || "Custom Theme",
    base,
    category: "custom",
    icon: "\uD83C\uDFA8",
    vars,
  };
}
