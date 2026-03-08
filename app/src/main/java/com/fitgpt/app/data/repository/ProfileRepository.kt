package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.UserProfile

/**
 * Handles profile reads and updates against backend profile endpoints.
 */
interface ProfileRepository {
    suspend fun getProfile(): UserProfile
    suspend fun updateProfile(
        bodyType: String,
        lifestyle: String,
        comfortPreference: String,
        onboardingComplete: Boolean
    ): UserProfile
}
