import { ROTATION_ALERT_PREFERENCES_KEY } from "./constants";
import { makeObjectStore } from "./userStorage";

export const ROTATION_REMINDER_OPTIONS = Object.freeze([
  { key: "quiet", label: "Less often", dismissDays: 14, maxItems: 3 },
  { key: "balanced", label: "Balanced", dismissDays: 7, maxItems: 3 },
  { key: "proactive", label: "More often", dismissDays: 3, maxItems: 3 },
]);

export const DEFAULT_ROTATION_ALERT_PREFERENCES = Object.freeze({
  enabled: true,
  reminderPace: "balanced",
});

const REMINDER_KEYS = new Set(ROTATION_REMINDER_OPTIONS.map((option) => option.key));
const { read: readLocal, write: writeLocal } = makeObjectStore(ROTATION_ALERT_PREFERENCES_KEY);

export function normalizeRotationAlertPreferences(raw) {
  const reminderPace = REMINDER_KEYS.has(raw?.reminderPace) ? raw.reminderPace : DEFAULT_ROTATION_ALERT_PREFERENCES.reminderPace;
  return {
    enabled: raw?.enabled !== false,
    reminderPace,
  };
}

function writePreferences(next, user) {
  const normalized = normalizeRotationAlertPreferences(next);
  writeLocal(normalized, user);
  return normalized;
}

export function readRotationAlertPreferences(user) {
  return normalizeRotationAlertPreferences(readLocal(user));
}

export function setRotationAlertsEnabled(enabled, user) {
  const current = readRotationAlertPreferences(user);
  return writePreferences({ ...current, enabled: !!enabled }, user);
}

export function setRotationReminderPace(reminderPace, user) {
  const current = readRotationAlertPreferences(user);
  return writePreferences({ ...current, reminderPace }, user);
}

export function getRotationReminderConfig(preferences) {
  const normalized = normalizeRotationAlertPreferences(preferences);
  return ROTATION_REMINDER_OPTIONS.find((option) => option.key === normalized.reminderPace)
    || ROTATION_REMINDER_OPTIONS[1];
}
