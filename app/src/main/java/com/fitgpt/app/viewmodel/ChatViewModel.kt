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

        val updatedMessages = _uiState.value.messages + ChatUiMessage(
            role = "user",
            content = normalized
        )
        _uiState.value = _uiState.value.copy(
            messages = updatedMessages,
            isLoading = true,
            error = null,
            pendingInput = normalized
        )
        runCatching { Log.i(CHAT_LOG_TAG, "send message count=${updatedMessages.size}") }

        viewModelScope.launch {
            try {
                val response = repository.sendChat(
                    updatedMessages.map { message ->
                        AiChatMessage(
                            role = message.role,
                            content = message.content
                        )
                    }
                )
                _uiState.value = _uiState.value.copy(
                    messages = updatedMessages + ChatUiMessage(
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
                    isLoading = false,
                    error = "Unable to send message. Please retry."
                )
            }
        }
    }

    fun retryLastMessage() {
        val lastInput = _uiState.value.pendingInput ?: return
        sendUserMessage(lastInput)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
