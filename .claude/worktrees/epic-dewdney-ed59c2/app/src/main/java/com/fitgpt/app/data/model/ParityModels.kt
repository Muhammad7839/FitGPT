package com.fitgpt.app.data.model

/**
 * Duplicate candidate pair surfaced for review in Android parity flows.
 */
data class DuplicateCandidate(
    val item: ClothingItem,
    val duplicateItem: ClothingItem,
    val similarityScore: Float,
    val reasons: List<String> = emptyList()
)

/**
 * Weather context returned alongside forecast recommendation results.
 */
data class ForecastWeatherContext(
    val city: String,
    val forecastTimestamp: Long,
    val temperatureF: Int,
    val weatherCategory: String,
    val condition: String,
    val description: String,
    val windMph: Float,
    val rainMm: Float,
    val snowMm: Float,
    val source: String
)

/**
 * Forecast-aware recommendation result used by the planner parity UI.
 */
data class ForecastRecommendationResult(
    val items: List<ClothingItem>,
    val explanation: String,
    val outfitScore: Float,
    val source: String,
    val fallbackUsed: Boolean,
    val warning: String?,
    val suggestionId: String?,
    val forecast: ForecastWeatherContext
)
