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
