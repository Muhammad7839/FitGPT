package com.fitgpt.app.data.model

/**
 * Local onboarding answers collected before authentication and synced to profile after sign-in.
 */
data class OnboardingAnswers(
    val stylePreferences: List<String> = emptyList(),
    val comfortPreferences: List<String> = emptyList(),
    val dressFor: List<String> = emptyList(),
    val bodyType: String? = null,
    val gender: String? = null,
    val heightCm: Int? = null
) {
    fun hasAnyValue(): Boolean {
        return stylePreferences.isNotEmpty() ||
            comfortPreferences.isNotEmpty() ||
            dressFor.isNotEmpty() ||
            !bodyType.isNullOrBlank() ||
            !gender.isNullOrBlank() ||
            heightCm != null
    }
}
