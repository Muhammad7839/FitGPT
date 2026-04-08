import { apiFetch } from "./apiFetch";

export async function sendChatMessage(messages, context = null) {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ messages, context }),
  });
}

export async function listChatConversations() {
  return apiFetch("/chat/conversations", {
    method: "GET",
  });
}

export async function syncChatConversations(conversations) {
  return apiFetch("/chat/conversations", {
    method: "PUT",
    body: JSON.stringify({
      conversations: Array.isArray(conversations) ? conversations : [],
    }),
  });
}
