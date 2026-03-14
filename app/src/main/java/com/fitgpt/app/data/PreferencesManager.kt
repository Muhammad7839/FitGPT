package com.fitgpt.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
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

    suspend fun setOnboardingCompleted() {
        context.dataStore.edit { preferences ->
            preferences[ONBOARDING_COMPLETED] = true
        }
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
