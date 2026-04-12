import { normalizeCategory, titleCase } from "./recommendationEngine";
import {
  DEFAULT_ROTATION_ALERT_PREFERENCES,
  getRotationReminderConfig,
  normalizeRotationAlertPreferences,
} from "./rotationAlertPreferences";

export const ROTATION_ALERT_DAYS = 30;
export const ROTATION_STALE_DAYS = 45;
export const ROTATION_FREQUENCY_LOOKBACK_DAYS = 14;
export const ROTATION_DISMISS_DAYS = 7;

function isActiveItem(item) {
  return item && item.is_active !== false && String(item.is_active) !== "false";
}

function readIsoTime(iso) {
  const ms = new Date(iso || "").getTime();
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(now, thenMs) {
  if (!Number.isFinite(thenMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - thenMs) / (24 * 60 * 60 * 1000)));
}

function formatRelativeDays(days) {
  if (!Number.isFinite(days)) return "Never logged";
  if (days <= 0) return "Worn today";
  if (days === 1) return "Worn yesterday";
  if (days < 7) return `Worn ${days} days ago`;
  if (days < 14) return "Worn 1 week ago";
  if (days < 60) return `Worn ${Math.round(days / 7)} weeks ago`;
  return `Worn ${Math.round(days / 30)} months ago`;
}

function wearCountLabel(count) {
  if (!count) return "Never logged";
  if (count === 1) return "Worn once";
  return `Worn ${count} times`;
}

function itemHistoryMap(history) {
  const stats = new Map();

  for (const entry of Array.isArray(history) ? history : []) {
    const wornAtMs = readIsoTime(entry?.worn_at);
    const ids = Array.isArray(entry?.item_ids) ? entry.item_ids : [];

    for (const rawId of ids) {
      const id = (rawId ?? "").toString().trim();
      if (!id) continue;

      const prev = stats.get(id) || { wearCount: 0, lastWornAtMs: null };
      const nextLastWorn = wornAtMs != null
        ? Math.max(prev.lastWornAtMs || 0, wornAtMs)
        : prev.lastWornAtMs;

      stats.set(id, {
        wearCount: prev.wearCount + 1,
        lastWornAtMs: nextLastWorn,
      });
    }
  }

  return stats;
}

function buildSuggestionPreview(itemId, outfits) {
  return (Array.isArray(outfits) ? outfits : [])
    .map((outfit, index) => ({ outfit, index }))
    .filter(({ outfit }) =>
      (Array.isArray(outfit) ? outfit : []).some((entry) => (entry?.id ?? "").toString().trim() === itemId)
    )
    .slice(0, 2)
    .map(({ outfit, index }) => {
      const items = Array.isArray(outfit) ? outfit : [];
      return {
        index,
        optionLabel: `Option ${String(index + 1).padStart(2, "0")}`,
        itemNames: items.map((entry) => entry?.name || "Item").filter(Boolean),
      };
    });
}

function triggerLabel(trigger) {
  if (trigger === "time") return "Long time since last worn";
  if (trigger === "frequency") return "Low wear frequency";
  if (trigger === "combo") return "Low wear frequency and stale";
  return "Never worn";
}

function urgencyTone({ wearCount, daysSinceLastWear, trigger }) {
  if (!wearCount || trigger === "combo" || daysSinceLastWear >= ROTATION_STALE_DAYS) return "high";
  if (trigger === "time" || trigger === "frequency") return "medium";
  return "low";
}

function reasonText({ name, wearCount, daysSinceLastWear, trigger }) {
  if (!wearCount) {
    return `You have not worn ${name} yet. Try bringing it back with one simple outfit.`;
  }

  if (trigger === "combo") {
    return `${name} has been quiet for ${daysSinceLastWear} days and is also trailing the rest of your wardrobe.`;
  }

  if (trigger === "time") {
    return `${name} has not been worn in ${daysSinceLastWear} days and is ready for another turn.`;
  }

  return `${name} is being worn less often than similar pieces in your active wardrobe.`;
}

function buildFrequencyBaseline(statsByItem) {
  const wearCounts = [...statsByItem.values()]
    .map((entry) => entry?.wearCount || 0)
    .filter((count) => count > 0);

  if (!wearCounts.length) {
    return {
      averageWearCount: 0,
      lowWearThreshold: 1,
    };
  }

  const averageWearCount = wearCounts.reduce((sum, count) => sum + count, 0) / wearCounts.length;
  return {
    averageWearCount,
    lowWearThreshold: Math.max(1, Math.floor(averageWearCount * 0.5)),
  };
}

function classifyTrigger({ wearCount, daysSinceLastWear, lowWearThreshold }) {
  const isNeverWorn = wearCount === 0;
  const isTimeBased = daysSinceLastWear >= ROTATION_ALERT_DAYS;
  const isFrequencyBased = wearCount > 0
    && wearCount <= lowWearThreshold
    && daysSinceLastWear >= ROTATION_FREQUENCY_LOOKBACK_DAYS;

  if (isNeverWorn) return "never";
  if (isTimeBased && isFrequencyBased) return "combo";
  if (isTimeBased) return "time";
  if (isFrequencyBased) return "frequency";
  return "";
}

function normalizeDismissedAlerts(dismissedAlerts, now, dismissDays = ROTATION_DISMISS_DAYS) {
  const source = dismissedAlerts && typeof dismissedAlerts === "object" ? dismissedAlerts : {};
  const minTimestamp = now - dismissDays * 24 * 60 * 60 * 1000;
  const next = {};

  for (const [itemId, timestamp] of Object.entries(source)) {
    const value = Number(timestamp);
    if (Number.isFinite(value) && value >= minTimestamp) {
      next[itemId] = value;
    }
  }

  return next;
}

export function analyzeWardrobeRotation({
  wardrobe,
  history,
  outfits,
  isGuestMode = false,
  dismissedAlerts = {},
  preferences = DEFAULT_ROTATION_ALERT_PREFERENCES,
  now = Date.now(),
}) {
  const safePreferences = normalizeRotationAlertPreferences(preferences);
  const reminderConfig = getRotationReminderConfig(safePreferences);
  const activeWardrobe = (Array.isArray(wardrobe) ? wardrobe : []).filter(isActiveItem);
  const activeCount = activeWardrobe.length;

  if (!activeCount) {
    return {
      state: "empty",
      badge: "Rotation alerts",
      title: "Add a few active items to start tracking rotation",
      text: "Once your wardrobe has enough pieces, FitGPT can flag items that are being neglected.",
      stats: [],
      items: [],
      dismissedAlerts: {},
    };
  }

  if (isGuestMode) {
    return {
      state: "guest",
      badge: "Rotation alerts",
      title: "Sign in to unlock underused clothing alerts",
      text: "FitGPT needs saved outfit history to spot neglected pieces and suggest when to wear them again.",
      stats: [
        { label: "Active items", value: String(activeCount) },
      ],
      items: [],
      dismissedAlerts: {},
    };
  }

  if (!safePreferences.enabled) {
    return {
      state: "disabled",
      badge: "Rotation alerts paused",
      title: "Underused clothing alerts are off",
      text: "Turn alerts back on anytime when you want FitGPT to flag pieces that have been sitting out.",
      stats: [
        { label: "Active items", value: String(activeCount) },
        { label: "Reminder pace", value: reminderConfig.label },
      ],
      items: [],
      dismissedAlerts: normalizeDismissedAlerts(dismissedAlerts, now, reminderConfig.dismissDays),
    };
  }

  const historyList = Array.isArray(history) ? history : [];
  if (!historyList.length) {
    return {
      state: "tracking",
      badge: "Rotation alerts",
      title: "Wear a few outfits to start rotation tracking",
      text: "After you save or reuse outfits, FitGPT will flag items that have not been worn recently and suggest how to rotate them back in.",
      stats: [
        { label: "Active items", value: String(activeCount) },
        { label: "Tracked outfits", value: "0" },
      ],
      items: [],
      dismissedAlerts: {},
    };
  }

  const statsByItem = itemHistoryMap(historyList);
  const { averageWearCount, lowWearThreshold } = buildFrequencyBaseline(statsByItem);
  const activeDismissals = normalizeDismissedAlerts(dismissedAlerts, now, reminderConfig.dismissDays);

  const candidates = activeWardrobe
    .map((item) => {
      const id = (item?.id ?? "").toString().trim();
      if (!id || activeDismissals[id]) return null;

      const stats = statsByItem.get(id) || { wearCount: 0, lastWornAtMs: null };
      const daysSinceLastWear = daysBetween(now, stats.lastWornAtMs);
      const trigger = classifyTrigger({
        wearCount: stats.wearCount,
        daysSinceLastWear,
        lowWearThreshold,
      });

      if (!trigger) return null;

      const suggestions = buildSuggestionPreview(id, outfits);
      const urgency = urgencyTone({
        wearCount: stats.wearCount,
        daysSinceLastWear,
        trigger,
      });

      return {
        id,
        name: item?.name || "Wardrobe item",
        category: normalizeCategory(item?.category) || "Wardrobe item",
        color: titleCase((item?.color || "").toString().trim()),
        imageUrl: item?.image_url || "",
        wearCount: stats.wearCount,
        daysSinceLastWear,
        lastWornLabel: formatRelativeDays(daysSinceLastWear),
        wearCountLabel: wearCountLabel(stats.wearCount),
        urgencyTone: urgency,
        trigger,
        triggerLabel: triggerLabel(trigger),
        suggestions,
        reason: reasonText({
          name: item?.name || "this item",
          wearCount: stats.wearCount,
          daysSinceLastWear,
          trigger,
        }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aSuggested = a.suggestions.length > 0 ? 1 : 0;
      const bSuggested = b.suggestions.length > 0 ? 1 : 0;
      if (aSuggested !== bSuggested) return bSuggested - aSuggested;

      const priority = { high: 3, medium: 2, low: 1 };
      if (priority[a.urgencyTone] !== priority[b.urgencyTone]) {
        return priority[b.urgencyTone] - priority[a.urgencyTone];
      }

      if (a.wearCount !== b.wearCount) return a.wearCount - b.wearCount;

      const aDays = Number.isFinite(a.daysSinceLastWear) ? a.daysSinceLastWear : 9999;
      const bDays = Number.isFinite(b.daysSinceLastWear) ? b.daysSinceLastWear : 9999;
      if (aDays !== bDays) return bDays - aDays;

      return a.name.localeCompare(b.name);
    });

  const neverWornCount = candidates.filter((item) => item.trigger === "never").length;
  const timeBasedCount = candidates.filter((item) => item.trigger === "time" || item.trigger === "combo").length;
  const frequencyBasedCount = candidates.filter((item) => item.trigger === "frequency" || item.trigger === "combo").length;

  if (!candidates.length) {
    return {
      state: "healthy",
      badge: "Rotation looks healthy",
      title: "Your active wardrobe is staying in rotation",
      text: "Nothing looks neglected right now. Recent wear history suggests your pieces are being used fairly evenly.",
      stats: [
        { label: "Tracked outfits", value: String(historyList.length) },
        { label: "Active items", value: String(activeCount) },
      ],
      items: [],
      dismissedAlerts: activeDismissals,
    };
  }

  return {
    state: "alert",
    badge: neverWornCount > 0 ? "Rediscover these items" : "Underused clothing",
    title: neverWornCount > 0
      ? "Some pieces have not made it into your tracked outfits yet"
      : "A few items are ready for another turn",
    text: "FitGPT looks at both last-worn timing and wear frequency so the alert feels meaningful instead of noisy.",
    stats: [
      { label: "Need attention", value: String(candidates.length) },
      { label: "30+ days idle", value: String(timeBasedCount) },
      { label: "Low frequency", value: String(frequencyBasedCount) },
    ],
    items: candidates.slice(0, reminderConfig.maxItems),
    dismissedAlerts: activeDismissals,
    meta: {
      averageWearCount,
      lowWearThreshold,
      reminderDays: reminderConfig.dismissDays,
    },
  };
}
