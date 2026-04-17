import { makeObjectStore } from "./userStorage";
import { ACCESSIBILITY_PREFS_KEY, EVT_ACCESSIBILITY_CHANGED } from "./constants";

export const TEXT_SIZES = ["default", "large", "xlarge"];

const store = makeObjectStore(ACCESSIBILITY_PREFS_KEY, EVT_ACCESSIBILITY_CHANGED);

function normalize(prefs) {
  const raw = prefs && typeof prefs === "object" ? prefs : {};
  const textSize = TEXT_SIZES.includes(raw.textSize) ? raw.textSize : "default";
  return { textSize };
}

export function readAccessibilityPrefs(user) {
  return normalize(store.read(user));
}

export function writeAccessibilityPrefs(prefs, user) {
  const safe = normalize(prefs);
  store.write(safe, user);
  return safe;
}

export function applyAccessibilityToDocument(prefs) {
  const safe = normalize(prefs);
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return safe;
  if (safe.textSize === "default") {
    root.removeAttribute("data-text-size");
  } else {
    root.setAttribute("data-text-size", safe.textSize);
  }
  return safe;
}

export function adaptAiText(text, prefs) {
  const safe = normalize(prefs);
  const raw = (text || "").toString();
  if (!raw) return raw;
  if (safe.textSize === "default") return raw;

  return raw
    .split(/\n{2,}/)
    .map((block) => splitLongSentences(block, safe.textSize === "xlarge" ? 140 : 180))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongSentences(block, maxChars) {
  const normalized = block.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.match(/[^.!?]+[.!?]*/g) || [normalized];
  const lines = [];
  let buffer = "";
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if ((buffer + " " + s).trim().length > maxChars && buffer) {
      lines.push(buffer.trim());
      buffer = s;
    } else {
      buffer = buffer ? `${buffer} ${s}` : s;
    }
  }
  if (buffer) lines.push(buffer.trim());
  return lines.join("\n\n");
}
