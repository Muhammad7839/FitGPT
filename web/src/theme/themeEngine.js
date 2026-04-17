// web/src/theme/themeEngine.js

const CUSTOM_PROPERTY_NAMES = [
  "--bg", "--text", "--muted", "--border",
  "--accent", "--accent-hover", "--accent-deep",
  "--accent-soft", "--accent-soft-2", "--accent-outline", "--accent-glow",
  "--wardrobe-blue", "--wardrobe-blue-soft",
  "--bgSoft", "--shadow", "--shadow-hover",
  "--pageBg1", "--pageBg2", "--focus",
  "--surface", "--surface-input", "--surface-border", "--surface-hover",
  "--accent-highlight", "--body-grad1", "--body-grad2",
];

/**
 * Apply a theme object to the document.
 * Sets data-theme to the theme's base (so existing dark selectors keep working),
 * then overrides CSS variables via inline styles on <html> (highest specificity).
 */
export function applyTheme(themeObj) {
  const el = document.documentElement;

  // 1. Set the base (light/dark) so all existing component selectors work
  el.setAttribute("data-theme", themeObj.base);

  // 1b. Mark high-contrast themes so accessibility-specific CSS can target them
  if (themeObj.highContrast) {
    el.setAttribute("data-hc", "true");
  } else {
    el.removeAttribute("data-hc");
  }

  // 2. Clear any previous inline overrides
  clearThemeOverrides();

  // 3. For classic light/dark, don't set inline vars — let :root / [data-theme] handle it
  if (themeObj.id === "light" || themeObj.id === "dark") return;

  // 4. Set all vars as inline styles (higher specificity than :root and [data-theme])
  const vars = themeObj.vars || {};
  for (const prop of CUSTOM_PROPERTY_NAMES) {
    if (vars[prop]) {
      el.style.setProperty(prop, vars[prop]);
    }
  }
}

/**
 * Remove all custom CSS property overrides from <html> inline styles.
 */
export function clearThemeOverrides() {
  const el = document.documentElement;
  for (const prop of CUSTOM_PROPERTY_NAMES) {
    el.style.removeProperty(prop);
  }
}
