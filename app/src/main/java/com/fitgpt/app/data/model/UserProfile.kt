package com.fitgpt.app.data.model

/**
 * Editable profile fields used by the profile screen.
 */
data class UserProfile(
    val email: String,
    val bodyType: String,
    val lifestyle: String,
    val comfortPreference: String,
    val onboardingComplete: Boolean
)
