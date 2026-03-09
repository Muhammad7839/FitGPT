package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.UserProfile
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.UserProfileUpdateRequest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Retrofit-backed profile repository.
 */
class RemoteProfileRepository(
    private val api: ApiService
) : ProfileRepository {

    override suspend fun getProfile(): UserProfile {
        val response = api.getProfileSummary()
        return UserProfile(
            id = response.id,
            email = response.email,
            avatarUrl = resolveApiUrl(response.avatarUrl),
            bodyType = response.bodyType,
            lifestyle = response.lifestyle,
            comfortPreference = response.comfortPreference,
            onboardingComplete = response.onboardingComplete,
            wardrobeCount = response.wardrobeCount,
            activeWardrobeCount = response.activeWardrobeCount,
            favoriteCount = response.favoriteCount,
            savedOutfitCount = response.savedOutfitCount,
            plannedOutfitCount = response.plannedOutfitCount,
            historyCount = response.historyCount
        )
    }

    override suspend fun updateProfile(
        bodyType: String,
        lifestyle: String,
        comfortPreference: String,
        onboardingComplete: Boolean
    ): UserProfile {
        api.updateMyProfile(
            UserProfileUpdateRequest(
                bodyType = bodyType,
                lifestyle = lifestyle,
                comfortPreference = comfortPreference,
                onboardingComplete = onboardingComplete
            )
        )
        val summary = api.getProfileSummary()
        return UserProfile(
            id = summary.id,
            email = summary.email,
            avatarUrl = resolveApiUrl(summary.avatarUrl),
            bodyType = summary.bodyType,
            lifestyle = summary.lifestyle,
            comfortPreference = summary.comfortPreference,
            onboardingComplete = summary.onboardingComplete,
            wardrobeCount = summary.wardrobeCount,
            activeWardrobeCount = summary.activeWardrobeCount,
            favoriteCount = summary.favoriteCount,
            savedOutfitCount = summary.savedOutfitCount,
            plannedOutfitCount = summary.plannedOutfitCount,
            historyCount = summary.historyCount
        )
    }

    override suspend fun uploadAvatar(bytes: ByteArray, fileName: String, mimeType: String): String {
        val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData(
            name = "image",
            filename = fileName,
            body = body
        )
        return resolveApiUrl(api.uploadMyAvatar(part).avatarUrl).orEmpty()
    }
}
