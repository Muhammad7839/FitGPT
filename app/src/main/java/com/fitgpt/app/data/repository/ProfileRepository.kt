package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.UserProfile

/**
 * Handles profile reads and updates against backend profile endpoints.
 */
interface ProfileRepository {
    suspend fun getProfile(): UserProfile
    suspend fun updateProfile(
        bodyType: String,
        stylePreferences: List<String>,
        comfortPreferences: List<String>,
        dressFor: List<String>,
        gender: String?,
        heightCm: Int?,
        onboardingComplete: Boolean
    ): UserProfile
    suspend fun completeOnboarding(
        stylePreferences: List<String>,
        comfortPreferences: List<String>,
        dressFor: List<String>,
        bodyType: String?,
        gender: String?,
        heightCm: Int?
    ): UserProfile
    suspend fun uploadAvatar(bytes: ByteArray, fileName: String, mimeType: String): String
}
