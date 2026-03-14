/**
 * Retrofit-backed chat repository that keeps AI provider access on backend only.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.ChatRequestDto
import com.fitgpt.app.data.remote.toDomain
import com.fitgpt.app.data.remote.toDto

class RemoteChatRepository(
    private val api: ApiService
) : ChatRepository {
    override suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse {
        return api.sendChatMessage(
            ChatRequestDto(messages = messages.map { it.toDto() })
        ).toDomain()
    }
}
