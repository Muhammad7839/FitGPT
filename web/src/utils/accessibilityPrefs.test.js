import {
  TEXT_SIZES,
  readAccessibilityPrefs,
  writeAccessibilityPrefs,
  applyAccessibilityToDocument,
  adaptAiText,
  effectiveAccessibilityPrefs,
} from "./accessibilityPrefs";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-text-size");
});

describe("readAccessibilityPrefs / writeAccessibilityPrefs", () => {
  test("returns defaults when nothing is stored", () => {
    expect(readAccessibilityPrefs(null).textSize).toBe("default");
  });

  test("round-trips valid text sizes", () => {
    writeAccessibilityPrefs({ textSize: "large" }, null);
    expect(readAccessibilityPrefs(null).textSize).toBe("large");
  });

  test("rejects invalid text sizes", () => {
    writeAccessibilityPrefs({ textSize: "invalid" }, null);
    expect(readAccessibilityPrefs(null).textSize).toBe("default");
  });

  test("exports supported text sizes", () => {
    expect(TEXT_SIZES).toEqual(expect.arrayContaining(["default", "large", "xlarge"]));
  });
});

describe("applyAccessibilityToDocument", () => {
  test("removes the data-text-size attribute for default", () => {
    document.documentElement.setAttribute("data-text-size", "large");
    applyAccessibilityToDocument({ textSize: "default" });
    expect(document.documentElement.hasAttribute("data-text-size")).toBe(false);
  });

  test("sets data-text-size for large", () => {
    applyAccessibilityToDocument({ textSize: "large" });
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
  });

  test("sets data-text-size for xlarge", () => {
    applyAccessibilityToDocument({ textSize: "xlarge" });
    expect(document.documentElement.getAttribute("data-text-size")).toBe("xlarge");
  });
});

describe("adaptAiText", () => {
  test("returns input unchanged for default text size", () => {
    const text = "This is a long AI response that should remain unchanged.";
    expect(adaptAiText(text, { textSize: "default" })).toBe(text);
  });

  test("inserts paragraph breaks for large text", () => {
    const longSentence = `${"A".repeat(100)}.`;
    const text = `${longSentence} ${longSentence} ${longSentence}`;
    expect(adaptAiText(text, { textSize: "large" }).split("\n\n").length).toBeGreaterThan(1);
  });

  test("breaks more aggressively for xlarge", () => {
    const longSentence = `${"A".repeat(80)}.`;
    const text = `${longSentence} ${longSentence} ${longSentence}`;
    const large = adaptAiText(text, { textSize: "large" });
    const xlarge = adaptAiText(text, { textSize: "xlarge" });
    expect(xlarge.split("\n\n").length).toBeGreaterThanOrEqual(large.split("\n\n").length);
  });

  test("handles empty input", () => {
    expect(adaptAiText("", { textSize: "large" })).toBe("");
    expect(adaptAiText(null, { textSize: "large" })).toBe("");
  });

  test("preserves existing paragraphs", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const out = adaptAiText(text, { textSize: "large" });
    expect(out).toContain("First paragraph.");
    expect(out).toContain("Second paragraph.");
  });
});

describe("effectiveAccessibilityPrefs", () => {
  test("keeps default when high contrast is inactive", () => {
    expect(effectiveAccessibilityPrefs({ textSize: "default" }, { highContrast: false }).textSize).toBe("default");
  });

  test("escalates default to large for high contrast themes", () => {
    expect(effectiveAccessibilityPrefs({ textSize: "default" }, { highContrast: true }).textSize).toBe("large");
  });

  test("preserves explicit large and xlarge values", () => {
    expect(effectiveAccessibilityPrefs({ textSize: "large" }, { highContrast: true }).textSize).toBe("large");
    expect(effectiveAccessibilityPrefs({ textSize: "xlarge" }, { highContrast: true }).textSize).toBe("xlarge");
  });

  test("handles null themes safely", () => {
    expect(effectiveAccessibilityPrefs({ textSize: "default" }, null).textSize).toBe("default");
  });
});
