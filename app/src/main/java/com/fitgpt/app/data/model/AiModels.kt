/**
 * Domain models for backend-proxied AI chat and AI recommendation flows.
 */
package com.fitgpt.app.data.model

data class AiChatMessage(
    val role: String,
    val content: String
)

data class AiChatResponse(
    val reply: String,
    val source: String,
    val fallbackUsed: Boolean,
    val warning: String?
)

data class AiRecommendationResult(
    val items: List<ClothingItem>,
    val explanation: String,
    val source: String,
    val fallbackUsed: Boolean,
    val warning: String?,
    val weatherCategory: String?,
    val occasion: String?,
    val suggestionId: String?,
    val itemExplanations: Map<Int, String>
)
