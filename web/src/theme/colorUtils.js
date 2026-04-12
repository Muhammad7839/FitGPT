// web/src/theme/colorUtils.js

/** Convert hex (#rrggbb or #rgb) to { r, g, b } (0-255) */
export function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** { r, g, b } → "#rrggbb" */
export function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** Return rgba() string with given alpha */
export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darken a hex color by amount (0-1) */
export function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: Math.round(r * (1 - amount)),
    g: Math.round(g * (1 - amount)),
    b: Math.round(b * (1 - amount)),
  });
}

/** Lighten a hex color by amount (0-1) */
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: Math.round(r + (255 - r) * amount),
    g: Math.round(g + (255 - g) * amount),
    b: Math.round(b + (255 - b) * amount),
  });
}

/**
 * From a single accent hex + base ("light"|"dark"), derive all accent-related CSS vars.
 * Returns an object like { "--accent-hover": "...", "--accent-deep": "...", ... }
 */
export function deriveAccentVars(accentHex, base) {
  const isLight = base === "light";
  return {
    "--accent-hover": isLight ? darken(accentHex, 0.2) : darken(accentHex, 0.18),
    "--accent-deep": isLight ? darken(accentHex, 0.35) : darken(accentHex, 0.28),
    "--accent-soft": withAlpha(accentHex, isLight ? 0.12 : 0.18),
    "--accent-soft-2": withAlpha(accentHex, isLight ? 0.08 : 0.10),
    "--accent-outline": withAlpha(accentHex, isLight ? 0.38 : 0.40),
    "--accent-glow": withAlpha(accentHex, isLight ? 0.14 : 0.20),
    "--focus": withAlpha(accentHex, 0.55),
    "--accent-highlight": isLight ? accentHex : lighten(accentHex, 0.3),
    "--surface-hover": withAlpha(accentHex, isLight ? 0.22 : 0.28),
    "--body-grad1": withAlpha(accentHex, isLight ? 0.10 : 0.12),
    "--body-grad2": withAlpha(accentHex, isLight ? 0.07 : 0.08),
  };
}
