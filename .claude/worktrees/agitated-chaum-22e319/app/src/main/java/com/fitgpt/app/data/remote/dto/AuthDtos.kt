/**
 * Transport models for authentication and profile responses.
 */
package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val email: String,
    val password: String
)

data class GoogleLoginRequest(
    @SerializedName("id_token")
    val idToken: String
)

data class ForgotPasswordRequest(
    val email: String
)

data class ForgotPasswordResponse(
    val detail: String,
    @SerializedName("reset_token")
    val resetToken: String? = null
)

data class ResetPasswordRequest(
    val token: String,
    @SerializedName("new_password")
    val newPassword: String
)

data class MessageResponse(
    val detail: String
)

data class TokenResponse(
    @SerializedName("access_token")
    val accessToken: String,
    @SerializedName("token_type")
    val tokenType: String
)

data class UserResponse(
    val id: Int,
    val email: String,
    @SerializedName("avatar_url")
    val avatarUrl: String? = null,
    @SerializedName("body_type")
    val bodyType: String,
    val lifestyle: String,
    @SerializedName("comfort_preference")
    val comfortPreference: String,
    @SerializedName("style_preferences")
    val stylePreferences: List<String> = emptyList(),
    @SerializedName("comfort_preferences")
    val comfortPreferences: List<String> = emptyList(),
    @SerializedName("dress_for")
    val dressFor: List<String> = emptyList(),
    val gender: String? = null,
    @SerializedName("height_cm")
    val heightCm: Int? = null,
    @SerializedName("onboarding_complete")
    val onboardingComplete: Boolean
)

data class UserProfileSummaryResponse(
    val id: Int,
    val email: String,
    @SerializedName("avatar_url")
    val avatarUrl: String? = null,
    @SerializedName("body_type")
    val bodyType: String,
    val lifestyle: String,
    @SerializedName("comfort_preference")
    val comfortPreference: String,
    @SerializedName("style_preferences")
    val stylePreferences: List<String> = emptyList(),
    @SerializedName("comfort_preferences")
    val comfortPreferences: List<String> = emptyList(),
    @SerializedName("dress_for")
    val dressFor: List<String> = emptyList(),
    val gender: String? = null,
    @SerializedName("height_cm")
    val heightCm: Int? = null,
    @SerializedName("onboarding_complete")
    val onboardingComplete: Boolean,
    @SerializedName("wardrobe_count")
    val wardrobeCount: Int,
    @SerializedName("active_wardrobe_count")
    val activeWardrobeCount: Int,
    @SerializedName("favorite_count")
    val favoriteCount: Int,
    @SerializedName("saved_outfit_count")
    val savedOutfitCount: Int,
    @SerializedName("planned_outfit_count")
    val plannedOutfitCount: Int,
    @SerializedName("history_count")
    val historyCount: Int
)

data class AvatarUploadResponse(
    @SerializedName("avatar_url")
    val avatarUrl: String
)

data class UserProfileUpdateRequest(
    @SerializedName("body_type")
    val bodyType: String? = null,
    val lifestyle: String? = null,
    @SerializedName("comfort_preference")
    val comfortPreference: String? = null,
    @SerializedName("style_preferences")
    val stylePreferences: List<String>? = null,
    @SerializedName("comfort_preferences")
    val comfortPreferences: List<String>? = null,
    @SerializedName("dress_for")
    val dressFor: List<String>? = null,
    val gender: String? = null,
    @SerializedName("height_cm")
    val heightCm: Int? = null,
    @SerializedName("onboarding_complete")
    val onboardingComplete: Boolean? = null
)
