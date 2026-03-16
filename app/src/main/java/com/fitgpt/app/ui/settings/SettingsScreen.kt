/**
 * App-level settings screen with appearance controls separated from profile identity data.
 */
package com.fitgpt.app.ui.settings

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.data.model.CustomThemePalette
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
import com.fitgpt.app.di.ServiceLocator
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    navController: NavController
) {
    val context = LocalContext.current
    val preferencesManager = remember { PreferencesManager(context) }
    val tokenStore = remember { ServiceLocator.provideTokenStore(context) }
    val themeMode by preferencesManager.themeMode.collectAsState(initial = ThemeMode.DARK)
    val themePreset by preferencesManager.themePreset.collectAsState(initial = ThemePreset.CLASSIC)
    val customThemeJson by preferencesManager.customThemeJson.collectAsState(initial = null)
    val storedCustomTheme = remember(customThemeJson) { CustomThemePalette.fromJson(customThemeJson) }
    val scope = rememberCoroutineScope()
    var customThemeName by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.name ?: "Custom Theme")
    }
    var customAccent by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.accentHex ?: "#C43C3C")
    }
    var customBackground by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.backgroundHex ?: "#141418")
    }
    var customText by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.textHex ?: "#E8E6E3")
    }
    var customSurface by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.surfaceHex ?: "#1C1C22")
    }
    var customAccentHover by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.accentHoverHex ?: "")
    }
    var customBorder by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.borderHex ?: "")
    }
    var customMuted by remember(storedCustomTheme) {
        mutableStateOf(storedCustomTheme?.mutedHex ?: "")
    }
    var customThemeError by remember { mutableStateOf<String?>(null) }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.SETTINGS,
        title = "Settings",
        showMoreAction = false
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionHeader(
                title = "Settings",
                subtitle = "Customize FitGPT preferences."
            )

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Appearance", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Choose your preferred theme mode.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = themeMode == ThemeMode.DARK,
                            onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.DARK) } },
                            label = { Text("Dark") }
                        )
                        FilterChip(
                            selected = themeMode == ThemeMode.LIGHT,
                            onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.LIGHT) } },
                            label = { Text("Light") }
                        )
                        FilterChip(
                            selected = themeMode == ThemeMode.SYSTEM,
                            onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.SYSTEM) } },
                            label = { Text("System") }
                        )
                    }

                    Text(
                        text = "Theme preset",
                        style = MaterialTheme.typography.titleSmall
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(ThemePreset.entries) { preset ->
                            FilterChip(
                                selected = themePreset == preset,
                                onClick = {
                                    scope.launch {
                                        preferencesManager.setThemePreset(preset)
                                    }
                                },
                                label = { Text(preset.label) }
                            )
                        }
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Custom theme", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Create your own palette (HEX colors).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    OutlinedTextField(
                        value = customThemeName,
                        onValueChange = { customThemeName = it },
                        label = { Text("Theme name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customAccent,
                        onValueChange = { customAccent = it },
                        label = { Text("Accent (#RRGGBB)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customBackground,
                        onValueChange = { customBackground = it },
                        label = { Text("Background (#RRGGBB)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customText,
                        onValueChange = { customText = it },
                        label = { Text("Text (#RRGGBB)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customSurface,
                        onValueChange = { customSurface = it },
                        label = { Text("Surface (#RRGGBB)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customAccentHover,
                        onValueChange = { customAccentHover = it },
                        label = { Text("Accent hover (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customBorder,
                        onValueChange = { customBorder = it },
                        label = { Text("Border (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = customMuted,
                        onValueChange = { customMuted = it },
                        label = { Text("Muted text (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                val normalizedAccent = CustomThemePalette.normalizeHex(customAccent, "#C43C3C")
                                val normalizedBackground = CustomThemePalette.normalizeHex(customBackground, "#141418")
                                val normalizedText = CustomThemePalette.normalizeHex(customText, "#E8E6E3")
                                val normalizedSurface = CustomThemePalette.normalizeHex(customSurface, "#1C1C22")
                                val normalizedHover = customAccentHover.trim().takeIf { it.isNotEmpty() }?.let {
                                    CustomThemePalette.normalizeHex(it, normalizedAccent)
                                }
                                val normalizedBorder = customBorder.trim().takeIf { it.isNotEmpty() }?.let {
                                    CustomThemePalette.normalizeHex(it, "#2F2F36")
                                }
                                val normalizedMuted = customMuted.trim().takeIf { it.isNotEmpty() }?.let {
                                    CustomThemePalette.normalizeHex(it, "#A7A4A0")
                                }
                                val payload = CustomThemePalette(
                                    name = customThemeName.trim().ifEmpty { "Custom Theme" },
                                    accentHex = normalizedAccent,
                                    backgroundHex = normalizedBackground,
                                    textHex = normalizedText,
                                    surfaceHex = normalizedSurface,
                                    accentHoverHex = normalizedHover,
                                    borderHex = normalizedBorder,
                                    mutedHex = normalizedMuted
                                )
                                customThemeError = null
                                scope.launch {
                                    preferencesManager.setCustomThemeJson(payload.toJson())
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Save custom theme")
                        }
                        Button(
                            onClick = {
                                customThemeError = null
                                scope.launch {
                                    preferencesManager.clearCustomTheme()
                                }
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Delete")
                        }
                    }
                    customThemeError?.let {
                        Text(text = it, color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Account", style = MaterialTheme.typography.titleMedium)
                    Button(
                        onClick = {
                            scope.launch {
                                tokenStore.clearToken()
                                navController.navigate(Routes.LOGIN) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        inclusive = true
                                    }
                                    launchSingleTop = true
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Sign out")
                    }
                }
            }
        }
    }
}
