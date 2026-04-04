/**
 * Centralized user-facing copy mappers so technical backend/status strings never leak into UI.
 */
package com.fitgpt.app.ui.common

import com.fitgpt.app.viewmodel.WeatherStatusType

fun weatherStatusBadge(type: WeatherStatusType): String {
    return when (type) {
        WeatherStatusType.LOADING -> "Updating weather"
        WeatherStatusType.USING_LOCATION -> "Using your location"
        WeatherStatusType.PERMISSION_NEEDED -> "Location permission needed"
        WeatherStatusType.MANUAL_CITY_FALLBACK -> "Enter city manually"
        WeatherStatusType.UNAVAILABLE -> "Weather unavailable"
        WeatherStatusType.AVAILABLE -> "Weather ready"
        WeatherStatusType.IDLE -> "Weather not set"
    }
}

fun weatherStatusMessage(type: WeatherStatusType, resolvedCity: String? = null): String {
    return when (type) {
        WeatherStatusType.LOADING -> "Checking the latest weather for better outfit suggestions."
        WeatherStatusType.USING_LOCATION -> {
            resolvedCity?.let { "Using current location: $it" } ?: "Using your current location."
        }
        WeatherStatusType.PERMISSION_NEEDED -> "Allow location access to detect your city automatically."
        WeatherStatusType.MANUAL_CITY_FALLBACK -> "Could not detect your city. Please enter it manually."
        WeatherStatusType.UNAVAILABLE -> "Weather is temporarily unavailable. You can still continue manually."
        WeatherStatusType.AVAILABLE -> {
            resolvedCity?.let { "Weather is ready for $it." } ?: "Weather is ready."
        }
        WeatherStatusType.IDLE -> "Add your city or use current location to personalize recommendations."
    }
}

fun recommendationSourceLabel(source: String, fallbackUsed: Boolean): String {
    return if (source.equals("ai", ignoreCase = true) && !fallbackUsed) {
        "AI stylist"
    } else {
        "Backup stylist mode"
    }
}

fun recommendationWarningLabel(rawWarning: String?): String? {
    val warning = rawWarning?.trim()?.lowercase().orEmpty()
    if (warning.isBlank()) return null
    return when (warning) {
        "provider_auth_failed" -> "Styling service is temporarily limited"
        "legacy_endpoint_fallback" -> "Using compatible recommendation mode"
        "fallback" -> "Using compatible recommendation mode"
        else -> "Using backup recommendation mode"
    }
}

fun recommendationScoreLabel(score: Float, fallbackUsed: Boolean): String? {
    if (fallbackUsed || score <= 0f) return null
    return "Confidence ${"%.0f".format(score * 100)}%"
}
