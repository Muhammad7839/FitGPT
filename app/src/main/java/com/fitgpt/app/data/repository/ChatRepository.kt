/**
 * Chat repository contract for backend-proxied AI messaging.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse

interface ChatRepository {
    suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse
}
