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
    @SerializedName("outfit_score")
    val outfitScore: Float = 0f,
    @SerializedName("confidence_score")
    val confidenceScore: Float? = null,
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
    val itemExplanations: List<AiRecommendationItemExplanationDto>,
    @SerializedName("outfit_options")
    val outfitOptions: List<OutfitOptionDto> = emptyList(),
    @SerializedName("prompt_feedback")
    val promptFeedback: PromptFeedbackMetadataDto? = null
)

data class PromptFeedbackMetadataDto(
    @SerializedName("should_prompt")
    val shouldPrompt: Boolean,
    val reason: String,
    @SerializedName("cooldown_seconds_remaining")
    val cooldownSecondsRemaining: Int
)

data class PromptFeedbackEventRequestDto(
    @SerializedName("event_type")
    val eventType: String,
    @SerializedName("suggestion_id")
    val suggestionId: String? = null
)

data class PromptFeedbackEventResponseDto(
    val detail: String
)

data class RejectOutfitRequestDto(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("suggestion_id")
    val suggestionId: String? = null,
    val reason: String? = null
)

data class RejectOutfitResponseDto(
    val detail: String,
    val fingerprint: String,
    @SerializedName("similarity_key")
    val similarityKey: String,
    val created: Boolean
)

data class RecommendationFeedbackRequestDto(
    @SerializedName("suggestion_id")
    val suggestionId: String,
    val signal: String,
    @SerializedName("item_ids")
    val itemIds: List<Int>? = null
)

data class RecommendationFeedbackResponseDto(
    val detail: String,
    @SerializedName("suggestion_id")
    val suggestionId: String,
    val signal: String
)

data class ForecastWeatherDto(
    val city: String,
    @SerializedName("forecast_timestamp")
    val forecastTimestamp: Long,
    @SerializedName("temperature_f")
    val temperatureF: Int,
    @SerializedName("weather_category")
    val weatherCategory: String,
    val condition: String,
    val description: String,
    @SerializedName("wind_mph")
    val windMph: Float,
    @SerializedName("rain_mm")
    val rainMm: Float,
    @SerializedName("snow_mm")
    val snowMm: Float,
    val source: String
)

data class ForecastRecommendationResponseDto(
    val items: List<ClothingItemDto>,
    val explanation: String,
    @SerializedName("outfit_score")
    val outfitScore: Float = 0f,
    @SerializedName("weather_category")
    val weatherCategory: String?,
    val occasion: String?,
    val source: String,
    @SerializedName("fallback_used")
    val fallbackUsed: Boolean,
    val warning: String?,
    @SerializedName("suggestion_id")
    val suggestionId: String?,
    val forecast: ForecastWeatherDto
)
