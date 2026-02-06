package com.fitgpt.app.data.model

data class UserPreferences(
    val bodyType: String,
    val stylePreference: String,
    val comfortPreference: Int,
    val preferredSeasons: List<String>,
    val accessibilityModeEnabled: Boolean = false
)