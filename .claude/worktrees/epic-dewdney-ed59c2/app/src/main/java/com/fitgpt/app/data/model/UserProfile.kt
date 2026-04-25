package com.fitgpt.app.data.model

/**
 * Editable profile fields used by the profile screen.
 */
data class UserProfile(
    val id: Int,
    val email: String,
    val avatarUrl: String? = null,
    val bodyType: String,
    val comfortPreference: String,
    val stylePreferences: List<String> = emptyList(),
    val comfortPreferences: List<String> = emptyList(),
    val dressFor: List<String> = emptyList(),
    val gender: String? = null,
    val heightCm: Int? = null,
    val onboardingComplete: Boolean,
    val wardrobeCount: Int = 0,
    val activeWardrobeCount: Int = 0,
    val favoriteCount: Int = 0,
    val savedOutfitCount: Int = 0,
    val plannedOutfitCount: Int = 0,
    val historyCount: Int = 0
)
