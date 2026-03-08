package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.UserProfile
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.UserProfileUpdateRequest

/**
 * Retrofit-backed profile repository.
 */
class RemoteProfileRepository(
    private val api: ApiService
) : ProfileRepository {

    override suspend fun getProfile(): UserProfile {
        val response = api.getCurrentUser()
        return UserProfile(
            email = response.email,
            bodyType = response.bodyType,
            lifestyle = response.lifestyle,
            comfortPreference = response.comfortPreference,
            onboardingComplete = response.onboardingComplete
        )
    }

    override suspend fun updateProfile(
        bodyType: String,
        lifestyle: String,
        comfortPreference: String,
        onboardingComplete: Boolean
    ): UserProfile {
        val response = api.updateMyProfile(
            UserProfileUpdateRequest(
                bodyType = bodyType,
                lifestyle = lifestyle,
                comfortPreference = comfortPreference,
                onboardingComplete = onboardingComplete
            )
        )
        return UserProfile(
            email = response.email,
            bodyType = response.bodyType,
            lifestyle = response.lifestyle,
            comfortPreference = response.comfortPreference,
            onboardingComplete = response.onboardingComplete
        )
    }
}
