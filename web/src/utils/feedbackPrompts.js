import { FEEDBACK_PROMPT_STATE_KEY } from "./constants";
import { safeParse } from "./helpers";

/* ── Timing constants ─────────────────────────────────────────────── */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;           /* 24 hours between prompts */
const BACKOFF_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; /* 7 days after 3 dismissals */
const MAX_DISMISSALS_BEFORE_BACKOFF = 3;
const MIN_ENGAGEMENT_SEC = 3;                        /* seconds viewing before prompt */
const MAX_PROMPTS_PER_SESSION = 1;
const MIN_TOTAL_VISITS = 2;                          /* skip first visit */

/* ── Prompt types ─────────────────────────────────────────────────── */
export const PROMPT_TYPES = {
  RATE_OUTFIT:    "rate_outfit",
  AFTER_REFRESH:  "after_refresh",
  AFTER_SAVE:     "after_save",
};

const PROMPT_TEXT = {
  [PROMPT_TYPES.RATE_OUTFIT]:   "Quick — does this outfit work for you?",
  [PROMPT_TYPES.AFTER_REFRESH]: "Not finding the right fit? A quick rating helps.",
  [PROMPT_TYPES.AFTER_SAVE]:    "Nice pick! Rate it so we learn your style.",
};

/* ── Storage helpers ──────────────────────────────────────────────── */
function storageKey(user) {
  const id = user?.id || user?.user_id || user?.email || user?.demoEmail || "";
  return id ? `${FEEDBACK_PROMPT_STATE_KEY}_${id}` : FEEDBACK_PROMPT_STATE_KEY;
}

function loadState(user) {
  try {
    const raw = localStorage.getItem(storageKey(user));
    const parsed = raw ? safeParse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

function saveState(state, user) {
  try { localStorage.setItem(storageKey(user), JSON.stringify(state)); } catch {}
}

/* ── Session tracking (resets on page load) ───────────────────────── */
let sessionPromptCount = 0;

export function resetSessionCount() { sessionPromptCount = 0; }

/* ── Core logic ───────────────────────────────────────────────────── */

export function shouldShowPrompt(user, { refreshCount = 0, justSaved = false, engagementSec = 0 } = {}) {
  if (sessionPromptCount >= MAX_PROMPTS_PER_SESSION) return { show: false, reason: "session_limit" };

  const state = loadState(user);
  const now = Date.now();
  const visits = (state.totalVisits || 0);

  if (visits < MIN_TOTAL_VISITS) return { show: false, reason: "first_visit" };

  /* Cooldown: 24h since last prompt, or 7d if user dismissed too many */
  const dismissals = state.consecutiveDismissals || 0;
  const cooldown = dismissals >= MAX_DISMISSALS_BEFORE_BACKOFF ? BACKOFF_COOLDOWN_MS : COOLDOWN_MS;
  const lastShown = state.lastShownAt || 0;
  if (now - lastShown < cooldown) return { show: false, reason: "cooldown" };

  /* Pick prompt type based on context */
  const type = computePromptType({ refreshCount, justSaved, engagementSec });
  if (!type) return { show: false, reason: "no_trigger" };

  return { show: true, type, text: PROMPT_TEXT[type] };
}

export function computePromptType({ refreshCount = 0, justSaved = false, engagementSec = 0 }) {
  if (justSaved) return PROMPT_TYPES.AFTER_SAVE;
  if (refreshCount >= 3) return PROMPT_TYPES.AFTER_REFRESH;
  if (engagementSec >= MIN_ENGAGEMENT_SEC) return PROMPT_TYPES.RATE_OUTFIT;
  return null;
}

export function recordVisit(user) {
  const state = loadState(user);
  state.totalVisits = (state.totalVisits || 0) + 1;
  saveState(state, user);
}

export function recordPromptShown(user, type) {
  sessionPromptCount++;
  const state = loadState(user);
  state.lastShownAt = Date.now();
  state.totalShown = (state.totalShown || 0) + 1;
  if (!state.shownByType) state.shownByType = {};
  state.shownByType[type] = (state.shownByType[type] || 0) + 1;
  saveState(state, user);
}

export function recordPromptEngaged(user, type) {
  const state = loadState(user);
  state.totalEngaged = (state.totalEngaged || 0) + 1;
  state.consecutiveDismissals = 0;
  if (!state.engagedByType) state.engagedByType = {};
  state.engagedByType[type] = (state.engagedByType[type] || 0) + 1;
  saveState(state, user);
}

export function recordPromptDismissed(user) {
  const state = loadState(user);
  state.totalDismissed = (state.totalDismissed || 0) + 1;
  state.consecutiveDismissals = (state.consecutiveDismissals || 0) + 1;
  saveState(state, user);
}

export function getPromptEffectiveness(user) {
  const state = loadState(user);
  const shown = state.totalShown || 0;
  const engaged = state.totalEngaged || 0;
  const dismissed = state.totalDismissed || 0;

  return {
    totalShown: shown,
    totalEngaged: engaged,
    totalDismissed: dismissed,
    engagementRate: shown > 0 ? Math.round((engaged / shown) * 100) : null,
    consecutiveDismissals: state.consecutiveDismissals || 0,
  };
}
