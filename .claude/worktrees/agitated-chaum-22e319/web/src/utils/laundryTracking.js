import { EVT_LAUNDRY_CHANGED, LAUNDRY_PREFERENCES_KEY } from "./constants";
import { makeObjectStore } from "./userStorage";

export const LAUNDRY_THRESHOLD_CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Other"];

export const DEFAULT_LAUNDRY_THRESHOLDS = Object.freeze({
  Tops: 2,
  Bottoms: 4,
  Outerwear: 7,
  Shoes: 6,
  Accessories: 10,
  Other: 4,
});

const { read: readLocal, write: writeLocal } = makeObjectStore(
  LAUNDRY_PREFERENCES_KEY,
  EVT_LAUNDRY_CHANGED
);

function clampThreshold(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(15, Math.max(1, Math.round(n)));
}

function normalizeCategory(rawCategory) {
  const value = (rawCategory || "").toString().trim().toLowerCase();
  if (value === "tops") return "Tops";
  if (value === "bottoms") return "Bottoms";
  if (value === "outerwear") return "Outerwear";
  if (value === "shoes") return "Shoes";
  if (value === "accessories") return "Accessories";
  return "Other";
}

function normalizeStringMap(raw) {
  const next = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return next;

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = (key || "").toString().trim();
    const normalizedValue = (value || "").toString().trim();
    if (!normalizedKey || !normalizedValue) continue;
    next[normalizedKey] = normalizedValue;
  }

  return next;
}

function normalizePreferences(raw) {
  const thresholds = { ...DEFAULT_LAUNDRY_THRESHOLDS };
  const rawThresholds = raw?.thresholds && typeof raw.thresholds === "object" ? raw.thresholds : {};

  for (const category of LAUNDRY_THRESHOLD_CATEGORIES) {
    thresholds[category] = clampThreshold(rawThresholds[category], DEFAULT_LAUNDRY_THRESHOLDS[category]);
  }

  return {
    enabled: raw?.enabled !== false,
    thresholds,
    washedAt: normalizeStringMap(raw?.washedAt),
    dismissedAlerts: normalizeStringMap(raw?.dismissedAlerts),
  };
}

function writePreferences(next, user) {
  const normalized = normalizePreferences(next);
  writeLocal(normalized, user);
  return normalized;
}

function buildAlertKey(itemId, reuseCount, threshold, lastWornAt) {
  return `${itemId}|${reuseCount}|${threshold}|${lastWornAt || ""}`;
}

function buildStatus(reuseCount, threshold) {
  if (reuseCount <= 0) {
    return {
      key: "fresh",
      label: "Fresh",
      tone: "fresh",
      suggestion: "Fresh and ready to wear.",
    };
  }

  if (reuseCount >= threshold) {
    return {
      key: "needs-wash",
      label: "Needs Wash",
      tone: "danger",
      suggestion: "Time to wash.",
    };
  }

  const nearingLine = Math.max(2, threshold - 1);
  if (reuseCount >= nearingLine || reuseCount / threshold >= 0.75) {
    return {
      key: "nearing",
      label: "Almost Due",
      tone: "warning",
      suggestion: "You've worn this a few times, consider washing it soon.",
    };
  }

  return {
    key: "worn",
    label: "In Rotation",
    tone: "neutral",
    suggestion: "Still in rotation, but keep an eye on it.",
  };
}

export function readLaundryPreferences(user) {
  return normalizePreferences(readLocal(user));
}

export function setLaundryTrackingEnabled(enabled, user) {
  const current = readLaundryPreferences(user);
  return writePreferences({ ...current, enabled: !!enabled }, user);
}

export function updateLaundryThreshold(category, value, user) {
  const current = readLaundryPreferences(user);
  const normalizedCategory = normalizeCategory(category);
  return writePreferences({
    ...current,
    thresholds: {
      ...current.thresholds,
      [normalizedCategory]: clampThreshold(value, current.thresholds[normalizedCategory]),
    },
  }, user);
}

export function resetLaundryThresholds(user) {
  const current = readLaundryPreferences(user);
  return writePreferences({
    ...current,
    thresholds: { ...DEFAULT_LAUNDRY_THRESHOLDS },
  }, user);
}

export function markLaundryItemWashed(itemId, user) {
  const normalizedId = (itemId || "").toString().trim();
  if (!normalizedId) return readLaundryPreferences(user);

  const current = readLaundryPreferences(user);
  const nextDismissed = { ...current.dismissedAlerts };
  delete nextDismissed[normalizedId];

  return writePreferences({
    ...current,
    washedAt: {
      ...current.washedAt,
      [normalizedId]: new Date().toISOString(),
    },
    dismissedAlerts: nextDismissed,
  }, user);
}

export function dismissLaundryAlert(itemId, alertKey, user) {
  const normalizedId = (itemId || "").toString().trim();
  const normalizedKey = (alertKey || "").toString().trim();
  if (!normalizedId || !normalizedKey) return readLaundryPreferences(user);

  const current = readLaundryPreferences(user);
  return writePreferences({
    ...current,
    dismissedAlerts: {
      ...current.dismissedAlerts,
      [normalizedId]: normalizedKey,
    },
  }, user);
}

export function restoreLaundryAlert(itemId, user) {
  const normalizedId = (itemId || "").toString().trim();
  if (!normalizedId) return readLaundryPreferences(user);

  const current = readLaundryPreferences(user);
  const nextDismissed = { ...current.dismissedAlerts };
  delete nextDismissed[normalizedId];

  return writePreferences({
    ...current,
    dismissedAlerts: nextDismissed,
  }, user);
}

export function getLaundryThresholdForItem(item, thresholds) {
  const category = normalizeCategory(item?.category);
  const safeThresholds = thresholds && typeof thresholds === "object"
    ? thresholds
    : DEFAULT_LAUNDRY_THRESHOLDS;
  return clampThreshold(safeThresholds[category], DEFAULT_LAUNDRY_THRESHOLDS[category]);
}

export function buildLaundryInsights({ wardrobe, history, preferences }) {
  const safePreferences = normalizePreferences(preferences);
  const wardrobeMap = new Map();
  const wearLogByItem = new Map();

  for (const item of Array.isArray(wardrobe) ? wardrobe : []) {
    const id = (item?.id ?? "").toString().trim();
    if (!id || wardrobeMap.has(id)) continue;
    wardrobeMap.set(id, item);
  }

  const sortedHistory = [...(Array.isArray(history) ? history : [])].sort((a, b) => {
    const da = (a?.worn_at || "").toString();
    const db = (b?.worn_at || "").toString();
    return db.localeCompare(da);
  });

  for (const entry of sortedHistory) {
    const uniqueIds = [...new Set(Array.isArray(entry?.item_ids) ? entry.item_ids : [])];
    const wornAt = (entry?.worn_at || "").toString();

    for (const rawId of uniqueIds) {
      const id = (rawId ?? "").toString().trim();
      if (!id) continue;
      if (!wearLogByItem.has(id)) wearLogByItem.set(id, []);
      wearLogByItem.get(id).push(wornAt);
    }
  }

  const items = [...wearLogByItem.entries()]
    .map(([id, wornAts]) => {
      const item = wardrobeMap.get(id) || {};
      const washedAt = (safePreferences.washedAt[id] || "").toString().trim();
      const threshold = getLaundryThresholdForItem(item, safePreferences.thresholds);
      const lastWornAt = wornAts[0] || "";
      const reuseCount = washedAt
        ? wornAts.filter((date) => date > washedAt).length
        : wornAts.length;
      const totalWearCount = wornAts.length;
      const status = buildStatus(reuseCount, threshold);
      const alertKey = buildAlertKey(id, reuseCount, threshold, lastWornAt);
      const alertDismissed = safePreferences.dismissedAlerts[id] === alertKey;
      const wearsRemaining = Math.max(threshold - reuseCount, 0);
      const percentUsed = threshold > 0
        ? Math.min(100, Math.round((reuseCount / threshold) * 100))
        : 0;

      return {
        id,
        name: item?.name || "Wardrobe Item",
        category: normalizeCategory(item?.category),
        imageUrl: item?.image_url || "",
        lastWornAt,
        washedAt,
        reuseCount,
        totalWearCount,
        threshold,
        wearsRemaining,
        percentUsed,
        statusKey: status.key,
        statusLabel: status.label,
        tone: status.tone,
        suggestion: status.suggestion,
        alertKey,
        alertDismissed,
      };
    })
    .sort((a, b) => {
      const priority = {
        "needs-wash": 3,
        nearing: 2,
        worn: 1,
        fresh: 0,
      };
      return (
        (priority[b.statusKey] || 0) - (priority[a.statusKey] || 0) ||
        (b.percentUsed - a.percentUsed) ||
        (b.lastWornAt || "").localeCompare(a.lastWornAt || "") ||
        (b.totalWearCount - a.totalWearCount)
      );
    });

  const alerts = safePreferences.enabled
    ? items.filter((item) => item.statusKey === "needs-wash" && !item.alertDismissed)
    : [];

  const overview = {
    trackedItems: items.length,
    dueCount: items.filter((item) => item.statusKey === "needs-wash").length,
    nearingCount: items.filter((item) => item.statusKey === "nearing").length,
    freshCount: items.filter((item) => item.statusKey === "fresh").length,
    averageReuse: items.length
      ? (items.reduce((sum, item) => sum + item.reuseCount, 0) / items.length).toFixed(1)
      : "0.0",
  };

  const frequentItems = [...items]
    .sort((a, b) => b.totalWearCount - a.totalWearCount || (b.lastWornAt || "").localeCompare(a.lastWornAt || ""))
    .slice(0, 4);

  return {
    preferences: safePreferences,
    items,
    alerts,
    frequentItems,
    overview,
  };
}
