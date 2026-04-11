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
        WeatherStatusType.MANUAL_CITY_FALLBACK -> "Location not ready"
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
        WeatherStatusType.MANUAL_CITY_FALLBACK -> {
            "We couldn't read the device location yet. On an emulator, set a mock location or enter a city manually."
        }
        WeatherStatusType.UNAVAILABLE -> {
            resolvedCity?.let {
                "We found $it, but live weather is unavailable right now. You can still continue manually."
            } ?: "Weather is temporarily unavailable. You can still continue manually."
        }
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
        "Wardrobe-based styling"
    }
}

fun recommendationWarningLabel(rawWarning: String?): String? {
    return null
}

fun recommendationScoreLabel(score: Float, fallbackUsed: Boolean): String? {
    if (fallbackUsed || score <= 0f) return null
    return "Confidence ${"%.0f".format(score * 100)}%"
}
