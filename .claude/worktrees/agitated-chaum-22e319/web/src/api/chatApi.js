import { apiFetch } from "./apiFetch";

export async function sendChatMessage(messages, context = null) {
  return apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({ messages, context }),
  });
}

export async function listChatConversations() {
  try {
    return await apiFetch("/chat/conversations", {
      method: "GET",
    });
  } catch (error) {
    if (error?.status === 404) {
      return { conversations: [], localOnly: true };
    }
    throw error;
  }
}

export async function syncChatConversations(conversations) {
  try {
    return await apiFetch("/chat/conversations", {
      method: "PUT",
      body: JSON.stringify({
        conversations: Array.isArray(conversations) ? conversations : [],
      }),
    });
  } catch (error) {
    if (error?.status === 404) {
      return { saved: false, localOnly: true };
    }
    throw error;
  }
}
