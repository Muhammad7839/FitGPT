import { apiFetch, hasApi } from "./apiFetch";
import { makeObjectStore, PROFILE_KEY } from "../utils/userStorage";

const { read: loadLocalProfile, write: saveLocalProfile } = makeObjectStore(PROFILE_KEY);

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

export async function completeOnboarding(answers, user) {
  const payload = {
    body_type: answers?.bodyType || null,
    style_preferences: Array.isArray(answers?.style) ? answers.style : [],
    comfort_preferences: Array.isArray(answers?.comfort) ? answers.comfort : [],
    dress_for: Array.isArray(answers?.dressFor) ? answers.dressFor : [],
    gender: answers?.gender || null,
    height_cm: answers?.heightCm ? Number(answers.heightCm) : null,
    onboarding_complete: true,
  };

  if (!hasApi()) {
    const current = loadLocalProfile(user);
    const next = { ...current, ...payload, updatedAt: Date.now() };
    saveLocalProfile(next, user);
    return next;
  }

  return apiFetch("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadProfileAvatar(file) {
  const formData = new FormData();
  formData.append("image", file);
  return apiFetch("/me/avatar", {
    method: "POST",
    body: formData,
  });
}
