import { apiFetch } from "./apiFetch";

export async function sendChatMessage(messages) {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
