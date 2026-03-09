/**
 * Verifies theme preference parsing defaults to dark mode on first launch.
 */
package com.fitgpt.app.data

import com.fitgpt.app.data.model.ThemeMode
import org.junit.Assert.assertEquals
import org.junit.Test

class PreferencesManagerTest {

    @Test
    fun mapStoredThemeMode_defaultsToDarkForMissingPreference() {
        assertEquals(ThemeMode.DARK, mapStoredThemeMode(null))
    }

    @Test
    fun mapStoredThemeMode_respectsKnownValues() {
        assertEquals(ThemeMode.DARK, mapStoredThemeMode(ThemeMode.DARK.name))
        assertEquals(ThemeMode.LIGHT, mapStoredThemeMode(ThemeMode.LIGHT.name))
        assertEquals(ThemeMode.SYSTEM, mapStoredThemeMode(ThemeMode.SYSTEM.name))
    }
}
