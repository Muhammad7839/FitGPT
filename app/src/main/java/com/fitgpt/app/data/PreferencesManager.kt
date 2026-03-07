/**
 * Encapsulates preference reads/writes so ViewModels avoid direct DataStore access.
 */
package com.fitgpt.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class PreferencesManager(
    private val context: Context
) {

    private val ONBOARDING_COMPLETED =
        booleanPreferencesKey("onboarding_completed")

    val onboardingCompleted: Flow<Boolean> =
        context.dataStore.data.map { preferences ->
            preferences[ONBOARDING_COMPLETED] ?: false
        }

    suspend fun setOnboardingCompleted() {
        // Persist onboarding completion once the user finishes the welcome flow.
        context.dataStore.edit { preferences ->
            preferences[ONBOARDING_COMPLETED] = true
        }
    }
}
