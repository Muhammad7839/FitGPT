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

    private fun mapStylePreferences(
        stylePreferences: List<String>,
        legacyLifestyle: String
    ): List<String> {
        return stylePreferences.ifEmpty {
            legacyLifestyle
                .takeIf { it.isNotBlank() && !it.equals("casual", ignoreCase = true) }
                ?.let { listOf(it) }
                ?: emptyList()
        }
    }

    private fun mapComfortPreferences(
        comfortPreferences: List<String>,
        legacyComfort: String
    ): List<String> {
        return comfortPreferences.ifEmpty {
            legacyComfort.takeIf { it.isNotBlank() }?.let { listOf(it) } ?: emptyList()
        }
    }

    private fun mapProfile(response: com.fitgpt.app.data.remote.dto.UserProfileSummaryResponse): UserProfile {
        return UserProfile(
            id = response.id,
            email = response.email,
            avatarUrl = resolveApiUrl(response.avatarUrl),
            bodyType = response.bodyType,
            comfortPreference = response.comfortPreference,
            stylePreferences = mapStylePreferences(response.stylePreferences, response.lifestyle),
            comfortPreferences = mapComfortPreferences(response.comfortPreferences, response.comfortPreference),
            dressFor = response.dressFor,
            gender = response.gender,
            heightCm = response.heightCm,
            onboardingComplete = response.onboardingComplete,
            wardrobeCount = response.wardrobeCount,
            activeWardrobeCount = response.activeWardrobeCount,
            favoriteCount = response.favoriteCount,
            savedOutfitCount = response.savedOutfitCount,
            plannedOutfitCount = response.plannedOutfitCount,
            historyCount = response.historyCount
        )
    }

    override suspend fun getProfile(): UserProfile {
        val response = api.getProfileSummary()
        return mapProfile(response)
    }

    override suspend fun updateProfile(
        bodyType: String,
        stylePreferences: List<String>,
        comfortPreferences: List<String>,
        dressFor: List<String>,
        gender: String?,
        heightCm: Int?,
        onboardingComplete: Boolean
    ): UserProfile {
        api.updateMyProfile(
            UserProfileUpdateRequest(
                bodyType = bodyType,
                lifestyle = stylePreferences.firstOrNull(),
                comfortPreference = comfortPreferences.firstOrNull(),
                stylePreferences = stylePreferences,
                comfortPreferences = comfortPreferences,
                dressFor = dressFor,
                gender = gender,
                heightCm = heightCm,
                onboardingComplete = onboardingComplete
            )
        )
        return mapProfile(api.getProfileSummary())
    }

    override suspend fun completeOnboarding(
        stylePreferences: List<String>,
        comfortPreferences: List<String>,
        dressFor: List<String>,
        bodyType: String?,
        gender: String?,
        heightCm: Int?
    ): UserProfile {
        api.completeOnboarding(
            UserProfileUpdateRequest(
                bodyType = bodyType,
                lifestyle = stylePreferences.firstOrNull(),
                comfortPreference = comfortPreferences.firstOrNull(),
                stylePreferences = stylePreferences,
                comfortPreferences = comfortPreferences,
                dressFor = dressFor,
                gender = gender,
                heightCm = heightCm,
                onboardingComplete = true
            )
        )
        return mapProfile(api.getProfileSummary())
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
