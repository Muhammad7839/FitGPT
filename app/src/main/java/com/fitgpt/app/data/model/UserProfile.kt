package com.fitgpt.app.data.model

/**
 * Editable profile fields used by the profile screen.
 */
data class UserProfile(
    val id: Int,
    val email: String,
    val bodyType: String,
    val lifestyle: String,
    val comfortPreference: String,
    val onboardingComplete: Boolean,
    val wardrobeCount: Int = 0,
    val activeWardrobeCount: Int = 0,
    val favoriteCount: Int = 0,
    val savedOutfitCount: Int = 0,
    val plannedOutfitCount: Int = 0,
    val historyCount: Int = 0
)
