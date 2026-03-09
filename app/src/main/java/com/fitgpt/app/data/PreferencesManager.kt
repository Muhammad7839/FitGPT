package com.fitgpt.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.fitgpt.app.data.model.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class PreferencesManager(
    private val context: Context
) {

    private val ONBOARDING_COMPLETED =
        booleanPreferencesKey("onboarding_completed")
    private val THEME_MODE = stringPreferencesKey("theme_mode")

    val onboardingCompleted: Flow<Boolean> =
        context.dataStore.data.map { preferences ->
            preferences[ONBOARDING_COMPLETED] ?: false
        }

    val themeMode: Flow<ThemeMode> = context.dataStore.data.map { preferences ->
        mapStoredThemeMode(preferences[THEME_MODE])
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
}

internal fun mapStoredThemeMode(value: String?): ThemeMode {
    return when (value) {
        ThemeMode.LIGHT.name -> ThemeMode.LIGHT
        ThemeMode.DARK.name -> ThemeMode.DARK
        ThemeMode.SYSTEM.name -> ThemeMode.SYSTEM
        else -> ThemeMode.DARK
    }
}
