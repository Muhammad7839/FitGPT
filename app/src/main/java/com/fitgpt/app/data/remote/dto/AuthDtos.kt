package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class TokenResponse(
    @SerializedName("access_token")
    val accessToken: String,
    @SerializedName("token_type")
    val tokenType: String
)

data class UserResponse(
    val id: Int,
    val email: String,
    @SerializedName("body_type")
    val bodyType: String,
    val lifestyle: String,
    @SerializedName("comfort_preference")
    val comfortPreference: String,
    @SerializedName("onboarding_complete")
    val onboardingComplete: Boolean
)

data class UserProfileUpdateRequest(
    @SerializedName("body_type")
    val bodyType: String? = null,
    val lifestyle: String? = null,
    @SerializedName("comfort_preference")
    val comfortPreference: String? = null,
    @SerializedName("onboarding_complete")
    val onboardingComplete: Boolean? = null
)
