import {
  PRESET_THEMES,
  buildCustomTheme,
  getPresetTheme,
  getThemesByCategory,
  isHighContrast,
} from "./themeDefinitions";

describe("preset themes", () => {
  test("includes high-contrast presets", () => {
    const ids = PRESET_THEMES.map((theme) => theme.id);
    expect(ids).toContain("contrast-light");
    expect(ids).toContain("contrast-dark");
  });

  test("groups accessibility presets", () => {
    const groups = getThemesByCategory();
    expect(groups.accessibility.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["contrast-light", "contrast-dark"])
    );
  });
});

describe("isHighContrast", () => {
  test("returns true for high-contrast themes", () => {
    expect(isHighContrast(getPresetTheme("contrast-light"))).toBe(true);
    expect(isHighContrast(getPresetTheme("contrast-dark"))).toBe(true);
  });

  test("returns false for regular presets and custom themes", () => {
    expect(isHighContrast(getPresetTheme("light"))).toBe(false);
    expect(isHighContrast(getPresetTheme("ocean"))).toBe(false);
    expect(
      isHighContrast(
        buildCustomTheme({
          id: "custom-theme",
          name: "Custom",
          base: "light",
          accent: "#ff0000",
          bg: "#ffffff",
        })
      )
    ).toBe(false);
  });

  test("handles null values", () => {
    expect(isHighContrast(null)).toBe(false);
    expect(isHighContrast(undefined)).toBe(false);
    expect(isHighContrast({})).toBe(false);
  });
});

describe("high-contrast invariants", () => {
  test("contrast-light uses black on white", () => {
    const theme = getPresetTheme("contrast-light");
    expect(theme.vars["--bg"]).toBe("#ffffff");
    expect(theme.vars["--text"]).toBe("#000000");
    expect(theme.vars["--surface"]).toBe("#ffffff");
    expect(theme.vars["--border"]).toBe("#000000");
  });

  test("contrast-dark uses white on black", () => {
    const theme = getPresetTheme("contrast-dark");
    expect(theme.vars["--bg"]).toBe("#000000");
    expect(theme.vars["--text"]).toBe("#ffffff");
    expect(theme.vars["--border"]).toBe("#ffffff");
  });
});
