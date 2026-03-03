import { apiFetch, hasApi } from "./apiFetch";
import { userKey, PROFILE_KEY } from "../utils/userStorage";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadLocalProfile(user) {
  const key = userKey(PROFILE_KEY, user);
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveLocalProfile(next, user) {
  const key = userKey(PROFILE_KEY, user);
  localStorage.setItem(key, JSON.stringify(next));
}

export async function saveProfileDraft(draft, user) {

  if (!hasApi()) {
    const current = loadLocalProfile(user);
    const next = { ...current, ...draft, updatedAt: Date.now() };
    saveLocalProfile(next, user);
    return next;
  }

  return apiFetch("/profile", {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export async function readProfile(user) {
  if (!hasApi()) return loadLocalProfile(user);


  return apiFetch("/profile", { method: "GET" });
}
