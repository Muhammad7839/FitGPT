/**
 * Thin wrappers around the Web Speech API for voice input + output.
 *
 * Speech recognition: Chrome/Edge/Safari expose `SpeechRecognition` (vendor-
 * prefixed `webkitSpeechRecognition`). Firefox has no support as of 2026 —
 * call `getSpeechRecognitionClass()` to feature-detect before using.
 *
 * Speech synthesis: available everywhere; callers should still check
 * `isSpeechSynthesisSupported()` for non-browser environments (tests, SSR).
 */

export function getSpeechRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return getSpeechRecognitionClass() !== null;
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isVoiceChatSupported() {
  return isSpeechRecognitionSupported() && isSpeechSynthesisSupported();
}

const URL_PATTERN = /\bhttps?:\/\/\S+/gi;
const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`([^`]*)`/g;
const BOLD_ITALIC_PATTERN = /(\*\*|__|\*|_)(.*?)\1/g;
const LIST_MARKER_PATTERN = /^\s*(?:[-*]|\d+\.)\s+/gm;
const HEADER_PATTERN = /^#{1,6}\s+/gm;

/**
 * Strip markdown + URLs so TTS doesn't pronounce punctuation or long links.
 */
export function stripMarkdownForSpeech(raw) {
  if (!raw) return "";
  return raw
    .replace(CODE_FENCE_PATTERN, " ")
    .replace(INLINE_CODE_PATTERN, "$1")
    .replace(BOLD_ITALIC_PATTERN, "$2")
    .replace(URL_PATTERN, "link")
    .replace(HEADER_PATTERN, "")
    .replace(LIST_MARKER_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice() {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefs = [
    (v) => /en-us/i.test(v.lang) && /google/i.test(v.name),
    (v) => /en-us/i.test(v.lang) && /natural|neural|samantha|ava|female/i.test(v.name),
    (v) => /en-us/i.test(v.lang),
    (v) => /^en/i.test(v.lang),
    () => true,
  ];
  for (const predicate of prefs) {
    const match = voices.find(predicate);
    if (match) return match;
  }
  return voices[0];
}

/**
 * Speak a string. Cancels any in-progress utterance first.
 * Returns a handle with `.cancel()` to stop playback early.
 */
export function speakText(text, options = {}) {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.(new Error("Speech synthesis not supported"));
    return { cancel: () => {} };
  }
  const clean = stripMarkdownForSpeech(text);
  if (!clean) {
    options.onEnd?.();
    return { cancel: () => {} };
  }

  window.speechSynthesis.cancel();

  const utterance = new window.SpeechSynthesisUtterance(clean);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  utterance.lang = options.lang ?? (voice?.lang || "en-US");

  let cancelled = false;
  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => {
    if (cancelled) return;
    options.onEnd?.();
  };
  utterance.onerror = (event) => {
    if (cancelled) return;
    options.onError?.(event.error || event);
  };

  window.speechSynthesis.speak(utterance);

  return {
    cancel() {
      cancelled = true;
      try { window.speechSynthesis.cancel(); } catch {}
    },
  };
}

export function cancelSpeech() {
  if (!isSpeechSynthesisSupported()) return;
  try { window.speechSynthesis.cancel(); } catch {}
}

/**
 * Some browsers don't populate `getVoices()` synchronously. Call this at
 * startup to warm the list so the first `speakText` picks a good voice.
 */
export function preloadVoices() {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.getVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  } catch {}
}
