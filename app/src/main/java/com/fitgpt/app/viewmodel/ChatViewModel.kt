package com.fitgpt.app.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.ai.GroqChatService
import com.fitgpt.app.data.model.ChatMessage
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.UserPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class ChatViewModel : ViewModel() {

    private val groqChatService = GroqChatService()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private var wardrobeItems: List<ClothingItem> = emptyList()
    private var userPreferences: UserPreferences? = null

    fun updateWardrobeContext(items: List<ClothingItem>, preferences: UserPreferences) {
        wardrobeItems = items
        userPreferences = preferences
    }

    fun sendMessage(text: String) {
        val userMessage = ChatMessage(
            id = UUID.randomUUID().toString(),
            role = "user",
            content = text,
            timestamp = System.currentTimeMillis()
        )
        _messages.value = _messages.value + userMessage

        if (!groqChatService.isAvailable) {
            _messages.value = _messages.value + ChatMessage(
                id = UUID.randomUUID().toString(),
                role = "assistant",
                content = "Chat is unavailable — no API key configured.",
                timestamp = System.currentTimeMillis(),
                isError = true
            )
            return
        }

        _isLoading.value = true

        viewModelScope.launch {
            try {
                val wardrobeContext = buildWardrobeContext()
                val conversationHistory = _messages.value.filter { !it.isError }
                val response = groqChatService.chat(conversationHistory, wardrobeContext)

                _messages.value = _messages.value + ChatMessage(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = response,
                    timestamp = System.currentTimeMillis()
                )
            } catch (e: Exception) {
                Log.e("ChatViewModel", "Chat failed", e)
                _messages.value = _messages.value + ChatMessage(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = "Something went wrong: ${e.message}",
                    timestamp = System.currentTimeMillis(),
                    isError = true
                )
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearChat() {
        _messages.value = emptyList()
    }

    fun retryLastMessage() {
        val msgs = _messages.value.toMutableList()
        // Remove the last error message
        if (msgs.isNotEmpty() && msgs.last().isError) {
            msgs.removeAt(msgs.lastIndex)
            _messages.value = msgs
        }
        // Find the last user message and resend
        val lastUserMessage = _messages.value.lastOrNull { it.role == "user" }
        if (lastUserMessage != null) {
            // Remove the last user message to avoid duplicates, then resend
            _messages.value = _messages.value.dropLast(1)
            sendMessage(lastUserMessage.content)
        }
    }

    private fun buildWardrobeContext(): String {
        val prefs = userPreferences
        val items = wardrobeItems

        if (items.isEmpty() && prefs == null) {
            return "The user hasn't added any wardrobe items or preferences yet."
        }

        val sb = StringBuilder()
        if (items.isNotEmpty()) {
            sb.appendLine("The user's wardrobe contains the following items:")
            for (item in items) {
                sb.appendLine("- ${item.category}: ${item.color}, ${item.season} season, comfort ${item.comfortLevel}/5")
            }
        } else {
            sb.appendLine("The user hasn't added any wardrobe items yet.")
        }

        if (prefs != null) {
            sb.appendLine()
            sb.appendLine("User preferences:")
            sb.appendLine("- Body type: ${prefs.bodyType}")
            sb.appendLine("- Style preference: ${prefs.stylePreference}")
            sb.appendLine("- Comfort preference: ${prefs.comfortPreference}/5")
            sb.appendLine("- Preferred seasons: ${prefs.preferredSeasons.joinToString(", ")}")
        }

        return sb.toString().trim()
    }
}
