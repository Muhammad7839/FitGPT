/**
 * Main Android entry activity that wires theme preferences and hosts Compose navigation.
 */
package com.fitgpt.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.fitgpt.app.data.model.CustomThemePalette
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
import com.fitgpt.app.navigation.AppNavHost
import com.fitgpt.app.ui.theme.FitGPTTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val preferencesManager = remember { PreferencesManager(applicationContext) }
            val themeMode by preferencesManager.themeMode.collectAsState(initial = ThemeMode.DARK)
            val themePreset by preferencesManager.themePreset.collectAsState(initial = ThemePreset.CLASSIC)
            val customThemeJson by preferencesManager.customThemeJson.collectAsState(initial = null)
            val customTheme = remember(customThemeJson) { CustomThemePalette.fromJson(customThemeJson) }
            val effectivePreset = remember(themePreset, customTheme) {
                if (themePreset == ThemePreset.CUSTOM && customTheme == null) {
                    ThemePreset.CLASSIC
                } else {
                    themePreset
                }
            }

            val darkTheme = when (themeMode) {
                ThemeMode.SYSTEM -> androidx.compose.foundation.isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }

            FitGPTTheme(
                darkTheme = darkTheme,
                preset = effectivePreset,
                customTheme = customTheme
            ) {
                AppNavHost()
            }
        }
    }
}
