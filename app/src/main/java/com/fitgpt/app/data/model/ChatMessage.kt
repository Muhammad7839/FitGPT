package com.fitgpt.app.data.model

data class ChatMessage(
    val id: String,
    val role: String,
    val content: String,
    val timestamp: Long,
    val isError: Boolean = false
)
