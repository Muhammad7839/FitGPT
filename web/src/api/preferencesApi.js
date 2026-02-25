import { apiFetch } from "./apiFetch";

export async function savePreferences(preferences) {
  return apiFetch("/me/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

export async function getPreferences() {
  return apiFetch("/me/preferences", { method: "GET" });
}