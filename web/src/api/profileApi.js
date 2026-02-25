import { apiFetch, hasApi } from "./apiFetch";

const PROFILE_KEY = "fitgpt_profile_v1";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadLocalProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveLocalProfile(next) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

export async function saveProfileDraft(draft) {
  // draft can include: style, dressFor, bodyType, preferences
  if (!hasApi()) {
    const current = loadLocalProfile();
    const next = { ...current, ...draft, updatedAt: Date.now() };
    saveLocalProfile(next);
    return next;
  }

  // Change endpoint if your backend differs
  return apiFetch("/profile", {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export async function readProfile() {
  if (!hasApi()) return loadLocalProfile();

  // Change endpoint if your backend differs
  return apiFetch("/profile", { method: "GET" });
}