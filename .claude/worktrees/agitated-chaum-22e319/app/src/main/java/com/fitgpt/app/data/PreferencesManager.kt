package com.fitgpt.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import com.fitgpt.app.data.model.OnboardingAnswers
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

const val CURRENT_TUTORIAL_VERSION = 1

class PreferencesManager(
    private val context: Context
) {

    private val ONBOARDING_COMPLETED =
        booleanPreferencesKey("onboarding_completed")
    private val THEME_MODE = stringPreferencesKey("theme_mode")
    private val THEME_PRESET_ID = stringPreferencesKey("theme_preset_id")
    private val ACTIVE_THEME_ID = stringPreferencesKey("active_theme_id")
    private val CUSTOM_THEME_JSON = stringPreferencesKey("custom_theme_json")
    private val TUTORIAL_SEEN_VERSION = intPreferencesKey("tutorial_seen_version")
    private val PROFILE_SKIN_TONE = stringPreferencesKey("profile_skin_tone")
    private val PROFILE_HAIR_COLOR = stringPreferencesKey("profile_hair_color")
    private val ONBOARDING_STYLE = stringSetPreferencesKey("onboarding_style")
    private val ONBOARDING_COMFORT = stringSetPreferencesKey("onboarding_comfort")
    private val ONBOARDING_DRESS_FOR = stringSetPreferencesKey("onboarding_dress_for")
    private val ONBOARDING_BODY_TYPE = stringPreferencesKey("onboarding_body_type")
    private val ONBOARDING_GENDER = stringPreferencesKey("onboarding_gender")
    private val ONBOARDING_HEIGHT_CM = intPreferencesKey("onboarding_height_cm")

    val onboardingCompleted: Flow<Boolean> =
        context.dataStore.data.map { preferences ->
            preferences[ONBOARDING_COMPLETED] ?: false
        }

    val themeMode: Flow<ThemeMode> = context.dataStore.data.map { preferences ->
        mapStoredThemeMode(preferences[THEME_MODE])
    }
    val themePreset: Flow<ThemePreset> = context.dataStore.data.map { preferences ->
        mapStoredThemePreset(preferences[THEME_PRESET_ID])
    }
    val activeThemeId: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[ACTIVE_THEME_ID]?.trim().takeUnless { it.isNullOrEmpty() } ?: ThemePreset.CLASSIC.id
    }
    val customThemeJson: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[CUSTOM_THEME_JSON]?.trim()?.takeIf { it.isNotEmpty() }
    }
    val tutorialCompleted: Flow<Boolean> = context.dataStore.data.map { preferences ->
        (preferences[TUTORIAL_SEEN_VERSION] ?: 0) >= CURRENT_TUTORIAL_VERSION
    }
    val profileSkinTone: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[PROFILE_SKIN_TONE].orEmpty()
    }
    val profileHairColor: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[PROFILE_HAIR_COLOR].orEmpty()
    }
    val onboardingAnswers: Flow<OnboardingAnswers> = context.dataStore.data.map { preferences ->
        OnboardingAnswers(
            stylePreferences = preferences[ONBOARDING_STYLE].orEmpty().sorted(),
            comfortPreferences = preferences[ONBOARDING_COMFORT].orEmpty().sorted(),
            dressFor = preferences[ONBOARDING_DRESS_FOR].orEmpty().sorted(),
            bodyType = preferences[ONBOARDING_BODY_TYPE]?.trim()?.takeIf { it.isNotEmpty() },
            gender = preferences[ONBOARDING_GENDER]?.trim()?.takeIf { it.isNotEmpty() },
            heightCm = preferences[ONBOARDING_HEIGHT_CM]
        )
    }

    suspend fun setOnboardingCompleted() {
        context.dataStore.edit { preferences ->
            preferences[ONBOARDING_COMPLETED] = true
        }
    }

    suspend fun setOnboardingAnswers(answers: OnboardingAnswers) {
        context.dataStore.edit { preferences ->
            preferences[ONBOARDING_STYLE] = answers.stylePreferences
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toSet()
            preferences[ONBOARDING_COMFORT] = answers.comfortPreferences
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toSet()
            preferences[ONBOARDING_DRESS_FOR] = answers.dressFor
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toSet()
            val bodyType = answers.bodyType?.trim().orEmpty()
            if (bodyType.isBlank()) {
                preferences.remove(ONBOARDING_BODY_TYPE)
            } else {
                preferences[ONBOARDING_BODY_TYPE] = bodyType
            }
            val gender = answers.gender?.trim().orEmpty()
            if (gender.isBlank()) {
                preferences.remove(ONBOARDING_GENDER)
            } else {
                preferences[ONBOARDING_GENDER] = gender
            }
            if (answers.heightCm != null) {
                preferences[ONBOARDING_HEIGHT_CM] = answers.heightCm
            } else {
                preferences.remove(ONBOARDING_HEIGHT_CM)
            }
        }
    }

    suspend fun getOnboardingAnswersSnapshot(): OnboardingAnswers {
        return onboardingAnswers.first()
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { preferences ->
            preferences[THEME_MODE] = mode.name
        }
    }

    suspend fun setThemePreset(preset: ThemePreset) {
        context.dataStore.edit { preferences ->
            preferences[THEME_PRESET_ID] = preset.id
            preferences[ACTIVE_THEME_ID] = preset.id
        }
    }

    suspend fun setCustomThemeJson(themeJson: String) {
        context.dataStore.edit { preferences ->
            preferences[CUSTOM_THEME_JSON] = themeJson
            preferences[THEME_PRESET_ID] = ThemePreset.CUSTOM.id
            preferences[ACTIVE_THEME_ID] = ThemePreset.CUSTOM.id
        }
    }

    suspend fun clearCustomTheme() {
        context.dataStore.edit { preferences ->
            preferences.remove(CUSTOM_THEME_JSON)
            if (preferences[ACTIVE_THEME_ID] == ThemePreset.CUSTOM.id) {
                preferences[ACTIVE_THEME_ID] = ThemePreset.CLASSIC.id
            }
            if (preferences[THEME_PRESET_ID] == ThemePreset.CUSTOM.id) {
                preferences[THEME_PRESET_ID] = ThemePreset.CLASSIC.id
            }
        }
    }

    suspend fun markTutorialSeen(version: Int = CURRENT_TUTORIAL_VERSION) {
        context.dataStore.edit { preferences ->
            preferences[TUTORIAL_SEEN_VERSION] = version
        }
    }

    suspend fun setLocalProfileDetails(
        skinTone: String,
        hairColor: String
    ) {
        context.dataStore.edit { preferences ->
            preferences[PROFILE_SKIN_TONE] = skinTone.trim()
            preferences[PROFILE_HAIR_COLOR] = hairColor.trim()
        }
    }
}

internal fun mapStoredThemeMode(value: String?): ThemeMode {
    return when (value) {
        ThemeMode.LIGHT.name -> ThemeMode.LIGHT
        ThemeMode.DARK.name -> ThemeMode.DARK
        ThemeMode.SYSTEM.name -> ThemeMode.SYSTEM
        else -> ThemeMode.DARK
    }
}

internal fun mapStoredThemePreset(value: String?): ThemePreset {
    return ThemePreset.fromStoredValue(value)
}
