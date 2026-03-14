/**
 * Verifies theme preference parsing defaults to dark mode on first launch.
 */
package com.fitgpt.app.data

import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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

    @Test
    fun mapStoredThemePreset_defaultsToClassicForMissingPreference() {
        assertEquals(ThemePreset.CLASSIC, mapStoredThemePreset(null))
    }

    @Test
    fun mapStoredThemePreset_resolvesByStableIdAndEnumName() {
        assertEquals(ThemePreset.OCEAN, mapStoredThemePreset("ocean"))
        assertEquals(ThemePreset.SUNSET, mapStoredThemePreset(ThemePreset.SUNSET.name))
        assertEquals(ThemePreset.CUSTOM, mapStoredThemePreset("custom"))
        assertEquals(ThemePreset.CLASSIC, mapStoredThemePreset("unknown"))
    }

    @Test
    fun tutorialVersion_defaultIsCurrentOrLower() {
        assertTrue(CURRENT_TUTORIAL_VERSION >= 1)
        assertFalse(CURRENT_TUTORIAL_VERSION < 1)
    }
}
