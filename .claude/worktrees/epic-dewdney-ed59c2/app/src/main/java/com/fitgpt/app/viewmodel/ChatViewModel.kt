/**
 * Manages AI chat state with backend-proxy messaging and retry support.
 */
package com.fitgpt.app.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.repository.ChatRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val CHAT_LOG_TAG = "FitGPTChat"

data class ChatUiMessage(
    val role: String,
    val content: String
)

data class ChatUiState(
    val messages: List<ChatUiMessage> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val source: String? = null,
    val fallbackUsed: Boolean = false,
    val warning: String? = null,
    val pendingInput: String? = null
)

class ChatViewModel(
    private val repository: ChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState

    fun sendUserMessage(input: String) {
        val normalized = input.trim()
        if (normalized.isEmpty()) {
            return
        }

        submitConversation(
            messages = _uiState.value.messages + ChatUiMessage(
                role = "user",
                content = normalized
            ),
            pendingInput = normalized
        )
    }

    fun retryLastMessage() {
        val lastInput = _uiState.value.pendingInput ?: return
        val currentMessages = _uiState.value.messages
        val messagesForRetry = if (
            currentMessages.lastOrNull()?.role == "user" &&
            currentMessages.lastOrNull()?.content == lastInput
        ) {
            currentMessages
        } else {
            currentMessages + ChatUiMessage(role = "user", content = lastInput)
        }
        submitConversation(
            messages = messagesForRetry,
            pendingInput = lastInput
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    private fun submitConversation(
        messages: List<ChatUiMessage>,
        pendingInput: String
    ) {
        _uiState.value = _uiState.value.copy(
            messages = messages,
            isLoading = true,
            error = null,
            pendingInput = pendingInput
        )
        runCatching { Log.i(CHAT_LOG_TAG, "send message count=${messages.size}") }

        viewModelScope.launch {
            try {
                val response = repository.sendChat(
                    messages.map { message ->
                        AiChatMessage(
                            role = message.role,
                            content = message.content
                        )
                    }
                )
                _uiState.value = _uiState.value.copy(
                    messages = messages + ChatUiMessage(
                        role = "assistant",
                        content = response.reply
                    ),
                    isLoading = false,
                    source = response.source,
                    fallbackUsed = response.fallbackUsed,
                    warning = response.warning,
                    pendingInput = null
                )
            } catch (exception: Exception) {
                runCatching { Log.w(CHAT_LOG_TAG, "send failed ${exception::class.simpleName}") }
                _uiState.value = _uiState.value.copy(
                    messages = messages,
                    isLoading = false,
                    error = "Unable to send message. Please retry."
                )
            }
        }
    }
}
