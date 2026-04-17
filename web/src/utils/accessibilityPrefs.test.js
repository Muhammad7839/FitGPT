import {
  TEXT_SIZES,
  readAccessibilityPrefs,
  writeAccessibilityPrefs,
  applyAccessibilityToDocument,
  adaptAiText,
} from "./accessibilityPrefs";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-text-size");
});

describe("readAccessibilityPrefs / writeAccessibilityPrefs", () => {
  test("returns defaults when nothing stored", () => {
    const p = readAccessibilityPrefs(null);
    expect(p.textSize).toBe("default");
  });

  test("round-trips textSize", () => {
    writeAccessibilityPrefs({ textSize: "large" }, null);
    const p = readAccessibilityPrefs(null);
    expect(p.textSize).toBe("large");
  });

  test("rejects invalid textSize", () => {
    writeAccessibilityPrefs({ textSize: "nonsense" }, null);
    const p = readAccessibilityPrefs(null);
    expect(p.textSize).toBe("default");
  });

  test("exposes the allowed text-size set", () => {
    expect(TEXT_SIZES).toEqual(expect.arrayContaining(["default", "large", "xlarge"]));
  });
});

describe("applyAccessibilityToDocument", () => {
  test("removes attribute when default", () => {
    document.documentElement.setAttribute("data-text-size", "large");
    applyAccessibilityToDocument({ textSize: "default" });
    expect(document.documentElement.hasAttribute("data-text-size")).toBe(false);
  });

  test("sets data-text-size attribute for large", () => {
    applyAccessibilityToDocument({ textSize: "large" });
    expect(document.documentElement.getAttribute("data-text-size")).toBe("large");
  });

  test("sets data-text-size attribute for xlarge", () => {
    applyAccessibilityToDocument({ textSize: "xlarge" });
    expect(document.documentElement.getAttribute("data-text-size")).toBe("xlarge");
  });
});

describe("adaptAiText", () => {
  test("returns input unchanged when textSize is default", () => {
    const text = "This is a very long sentence that goes on and on without any breaks and exceeds the threshold.";
    expect(adaptAiText(text, { textSize: "default" })).toBe(text);
  });

  test("inserts paragraph breaks in long text for large", () => {
    const longSentence = "A".repeat(100) + ".";
    const text = `${longSentence} ${longSentence} ${longSentence}`;
    const out = adaptAiText(text, { textSize: "large" });
    expect(out.split("\n\n").length).toBeGreaterThan(1);
  });

  test("breaks more aggressively for xlarge than large", () => {
    const longSentence = "A".repeat(80) + ".";
    const text = `${longSentence} ${longSentence} ${longSentence}`;
    const forLarge = adaptAiText(text, { textSize: "large" });
    const forXLarge = adaptAiText(text, { textSize: "xlarge" });
    expect(forXLarge.split("\n\n").length).toBeGreaterThanOrEqual(forLarge.split("\n\n").length);
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
