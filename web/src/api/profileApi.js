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
