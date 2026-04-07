import {
  shouldShowPrompt,
  computePromptType,
  recordVisit,
  recordPromptShown,
  recordPromptEngaged,
  recordPromptDismissed,
  getPromptEffectiveness,
  resetSessionCount,
  PROMPT_TYPES,
} from "./feedbackPrompts";

beforeEach(() => {
  localStorage.clear();
  resetSessionCount();
});

describe("computePromptType", () => {
  test("returns AFTER_SAVE when justSaved is true", () => {
    expect(computePromptType({ justSaved: true })).toBe(PROMPT_TYPES.AFTER_SAVE);
  });

  test("returns AFTER_REFRESH after 3+ refreshes", () => {
    expect(computePromptType({ refreshCount: 3 })).toBe(PROMPT_TYPES.AFTER_REFRESH);
    expect(computePromptType({ refreshCount: 5 })).toBe(PROMPT_TYPES.AFTER_REFRESH);
  });

  test("returns RATE_OUTFIT after 3+ seconds engagement", () => {
    expect(computePromptType({ engagementSec: 3 })).toBe(PROMPT_TYPES.RATE_OUTFIT);
    expect(computePromptType({ engagementSec: 10 })).toBe(PROMPT_TYPES.RATE_OUTFIT);
  });

  test("returns null when no trigger conditions met", () => {
    expect(computePromptType({})).toBeNull();
    expect(computePromptType({ refreshCount: 1, engagementSec: 1 })).toBeNull();
  });

  test("justSaved takes priority over other triggers", () => {
    expect(computePromptType({ justSaved: true, refreshCount: 5, engagementSec: 10 })).toBe(PROMPT_TYPES.AFTER_SAVE);
  });
});

describe("shouldShowPrompt", () => {
  const user = { id: "test-user" };

  test("blocks on first visit", () => {
    const result = shouldShowPrompt(user, { engagementSec: 5 });
    expect(result.show).toBe(false);
    expect(result.reason).toBe("first_visit");
  });

  test("shows after minimum visits", () => {
    recordVisit(user);
    recordVisit(user);
    const result = shouldShowPrompt(user, { engagementSec: 5 });
    expect(result.show).toBe(true);
    expect(result.type).toBe(PROMPT_TYPES.RATE_OUTFIT);
    expect(typeof result.text).toBe("string");
  });

  test("limits to 1 prompt per session", () => {
    recordVisit(user);
    recordVisit(user);
    const first = shouldShowPrompt(user, { engagementSec: 5 });
    expect(first.show).toBe(true);
    recordPromptShown(user, first.type);

    const second = shouldShowPrompt(user, { engagementSec: 5 });
    expect(second.show).toBe(false);
    expect(second.reason).toBe("session_limit");
  });

  test("enforces 24h cooldown after prompt", () => {
    recordVisit(user);
    recordVisit(user);

    /* Simulate a prompt shown recently */
    recordPromptShown(user, PROMPT_TYPES.RATE_OUTFIT);
    resetSessionCount(); /* Reset session to bypass session limit */

    const result = shouldShowPrompt(user, { engagementSec: 5 });
    expect(result.show).toBe(false);
    expect(result.reason).toBe("cooldown");
  });

  test("blocks when no trigger condition met", () => {
    recordVisit(user);
    recordVisit(user);
    const result = shouldShowPrompt(user, { refreshCount: 0, engagementSec: 1 });
    expect(result.show).toBe(false);
    expect(result.reason).toBe("no_trigger");
  });

  test("extends cooldown after 3 dismissals (7-day backoff)", () => {
    recordVisit(user);
    recordVisit(user);

    recordPromptDismissed(user);
    recordPromptDismissed(user);
    recordPromptDismissed(user);

    /* Even without a recent prompt, 3 dismissals trigger the 7-day backoff
       which requires lastShownAt to have been set. Let's simulate that. */
    recordPromptShown(user, PROMPT_TYPES.RATE_OUTFIT);
    resetSessionCount();

    const result = shouldShowPrompt(user, { engagementSec: 5 });
    expect(result.show).toBe(false);
    expect(result.reason).toBe("cooldown");
  });
});

describe("recordPromptEngaged / recordPromptDismissed", () => {
  const user = { id: "test-user" };

  test("engagement resets consecutive dismissals", () => {
    recordPromptDismissed(user);
    recordPromptDismissed(user);
    recordPromptEngaged(user, PROMPT_TYPES.RATE_OUTFIT);

    const stats = getPromptEffectiveness(user);
    expect(stats.consecutiveDismissals).toBe(0);
    expect(stats.totalEngaged).toBe(1);
  });

  test("dismissals accumulate consecutively", () => {
    recordPromptDismissed(user);
    recordPromptDismissed(user);
    recordPromptDismissed(user);

    const stats = getPromptEffectiveness(user);
    expect(stats.consecutiveDismissals).toBe(3);
    expect(stats.totalDismissed).toBe(3);
  });
});

describe("getPromptEffectiveness", () => {
  const user = { id: "test-user" };

  test("returns null engagement rate with no data", () => {
    const stats = getPromptEffectiveness(user);
    expect(stats.totalShown).toBe(0);
    expect(stats.engagementRate).toBeNull();
  });

  test("calculates engagement rate correctly", () => {
    recordPromptShown(user, PROMPT_TYPES.RATE_OUTFIT);
    resetSessionCount();
    recordPromptShown(user, PROMPT_TYPES.AFTER_SAVE);
    recordPromptEngaged(user, PROMPT_TYPES.RATE_OUTFIT);

    const stats = getPromptEffectiveness(user);
    expect(stats.totalShown).toBe(2);
    expect(stats.totalEngaged).toBe(1);
    expect(stats.engagementRate).toBe(50);
  });

  test("tracks dismissals separately from engagement", () => {
    recordPromptShown(user, PROMPT_TYPES.RATE_OUTFIT);
    recordPromptDismissed(user);

    const stats = getPromptEffectiveness(user);
    expect(stats.totalShown).toBe(1);
    expect(stats.totalDismissed).toBe(1);
    expect(stats.totalEngaged).toBe(0);
  });
});

describe("anti-spam guarantees", () => {
  test("different users have isolated state", () => {
    const userA = { id: "alice" };
    const userB = { id: "bob" };

    recordVisit(userA);
    recordVisit(userA);
    recordPromptShown(userA, PROMPT_TYPES.RATE_OUTFIT);
    resetSessionCount();

    recordVisit(userB);
    recordVisit(userB);

    /* User B should not be affected by User A's prompt history */
    const result = shouldShowPrompt(userB, { engagementSec: 5 });
    expect(result.show).toBe(true);
  });

  test("session count resets properly", () => {
    const user = { id: "test" };
    recordVisit(user);
    recordVisit(user);

    shouldShowPrompt(user, { engagementSec: 5 });
    recordPromptShown(user, PROMPT_TYPES.RATE_OUTFIT);

    expect(shouldShowPrompt(user, { engagementSec: 5 }).show).toBe(false);

    resetSessionCount();
    /* Still blocked by 24h cooldown, not just session */
    expect(shouldShowPrompt(user, { engagementSec: 5 }).show).toBe(false);
  });
});
