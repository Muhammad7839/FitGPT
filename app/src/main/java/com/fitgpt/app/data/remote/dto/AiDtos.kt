/**
 * Transport DTOs for additive AI chat and recommendation APIs.
 */
package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ChatMessageDto(
    val role: String,
    val content: String
)

data class ChatRequestDto(
    val messages: List<ChatMessageDto>
)

data class ChatResponseDto(
    val reply: String,
    val source: String,
    @SerializedName("fallback_used")
    val fallbackUsed: Boolean,
    val warning: String?
)

data class AiRecommendationRequestDto(
    @SerializedName("manual_temp")
    val manualTemp: Int? = null,
    @SerializedName("time_context")
    val timeContext: String? = null,
    @SerializedName("plan_date")
    val planDate: String? = null,
    val exclude: String? = null,
    @SerializedName("weather_city")
    val weatherCity: String? = null,
    @SerializedName("weather_lat")
    val weatherLat: Double? = null,
    @SerializedName("weather_lon")
    val weatherLon: Double? = null,
    @SerializedName("weather_category")
    val weatherCategory: String? = null,
    val occasion: String? = null,
    @SerializedName("style_preference")
    val stylePreference: String? = null,
    @SerializedName("preferred_seasons")
    val preferredSeasons: List<String> = emptyList()
)

data class AiRecommendationItemExplanationDto(
    @SerializedName("item_id")
    val itemId: Int,
    val explanation: String
)

data class AiRecommendationResponseDto(
    val items: List<ClothingItemDto>,
    val explanation: String,
    @SerializedName("weather_category")
    val weatherCategory: String?,
    val occasion: String?,
    val source: String,
    @SerializedName("fallback_used")
    val fallbackUsed: Boolean,
    val warning: String?,
    @SerializedName("suggestion_id")
    val suggestionId: String?,
    @SerializedName("item_explanations")
    val itemExplanations: List<AiRecommendationItemExplanationDto>
)
