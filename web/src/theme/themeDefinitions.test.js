import {
  PRESET_THEMES,
  getPresetTheme,
  getThemesByCategory,
  isHighContrast,
  buildCustomTheme,
} from "./themeDefinitions";

describe("Preset themes registry", () => {
  test("includes both high-contrast presets", () => {
    const ids = PRESET_THEMES.map((t) => t.id);
    expect(ids).toContain("contrast-light");
    expect(ids).toContain("contrast-dark");
  });

  test("high-contrast presets are flagged highContrast:true", () => {
    const hcLight = getPresetTheme("contrast-light");
    const hcDark = getPresetTheme("contrast-dark");
    expect(hcLight.highContrast).toBe(true);
    expect(hcDark.highContrast).toBe(true);
  });

  test("other presets are not marked high contrast", () => {
    const others = PRESET_THEMES.filter((t) => !["contrast-light", "contrast-dark"].includes(t.id));
    for (const t of others) {
      expect(!!t.highContrast).toBe(false);
    }
  });

  test("groups accessibility category", () => {
    const groups = getThemesByCategory();
    expect(groups.accessibility).toBeDefined();
    expect(groups.accessibility.map((t) => t.id)).toEqual(
      expect.arrayContaining(["contrast-light", "contrast-dark"])
    );
  });
});

describe("isHighContrast", () => {
  test("returns true for high-contrast presets", () => {
    expect(isHighContrast(getPresetTheme("contrast-light"))).toBe(true);
    expect(isHighContrast(getPresetTheme("contrast-dark"))).toBe(true);
  });

  test("returns false for normal presets", () => {
    expect(isHighContrast(getPresetTheme("light"))).toBe(false);
    expect(isHighContrast(getPresetTheme("dark"))).toBe(false);
    expect(isHighContrast(getPresetTheme("ocean"))).toBe(false);
  });

  test("handles null/undefined safely", () => {
    expect(isHighContrast(null)).toBe(false);
    expect(isHighContrast(undefined)).toBe(false);
    expect(isHighContrast({})).toBe(false);
  });

  test("custom themes without highContrast flag are not HC", () => {
    const custom = buildCustomTheme({
      id: "custom1",
      name: "Custom",
      base: "light",
      accent: "#ff0000",
      bg: "#ffffff",
    });
    expect(isHighContrast(custom)).toBe(false);
  });
});

describe("High-contrast theme color invariants", () => {
  test("contrast-light uses pure black on pure white", () => {
    const t = getPresetTheme("contrast-light");
    expect(t.vars["--bg"]).toBe("#ffffff");
    expect(t.vars["--text"]).toBe("#000000");
    expect(t.vars["--surface"]).toBe("#ffffff");
    expect(t.vars["--border"]).toBe("#000000");
  });

  test("contrast-dark uses pure white on pure black", () => {
    const t = getPresetTheme("contrast-dark");
    expect(t.vars["--bg"]).toBe("#000000");
    expect(t.vars["--text"]).toBe("#ffffff");
    expect(t.vars["--border"]).toBe("#ffffff");
  });
});
