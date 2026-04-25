/**
 * App-level settings screen with consumer-friendly appearance options and account actions.
 */
package com.fitgpt.app.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.data.model.ThemePreset
import com.fitgpt.app.di.ServiceLocator
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import kotlinx.coroutines.launch

private data class ThemeChoice(
    val label: String,
    val mode: ThemeMode,
    val preset: ThemePreset
)

private val themeChoices = listOf(
    ThemeChoice(label = "System Default", mode = ThemeMode.SYSTEM, preset = ThemePreset.CLASSIC),
    ThemeChoice(label = "Light", mode = ThemeMode.LIGHT, preset = ThemePreset.CLASSIC),
    ThemeChoice(label = "Dark", mode = ThemeMode.DARK, preset = ThemePreset.CLASSIC),
    ThemeChoice(label = "Ocean", mode = ThemeMode.LIGHT, preset = ThemePreset.OCEAN),
    ThemeChoice(label = "Sunset", mode = ThemeMode.LIGHT, preset = ThemePreset.SUNSET),
    ThemeChoice(label = "Forest", mode = ThemeMode.LIGHT, preset = ThemePreset.FOREST),
    ThemeChoice(label = "Spring", mode = ThemeMode.LIGHT, preset = ThemePreset.SPRING),
    ThemeChoice(label = "Midnight", mode = ThemeMode.DARK, preset = ThemePreset.MIDNIGHT),
    ThemeChoice(label = "Cyberpunk", mode = ThemeMode.DARK, preset = ThemePreset.CYBERPUNK),
    ThemeChoice(label = "Lavender", mode = ThemeMode.LIGHT, preset = ThemePreset.LAVENDER)
)

@Composable
fun SettingsScreen(
    navController: NavController
) {
    val context = LocalContext.current
    val preferencesManager = remember { PreferencesManager(context) }
    val tokenStore = remember { ServiceLocator.provideTokenStore(context) }
    val themeMode by preferencesManager.themeMode.collectAsState(initial = ThemeMode.DARK)
    val themePreset by preferencesManager.themePreset.collectAsState(initial = ThemePreset.CLASSIC)
    val scope = rememberCoroutineScope()

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
                subtitle = "Customize the app experience."
            )

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Theme", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Pick the look that feels best to you.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    themeChoices.forEach { choice ->
                        val selected = themeMode == choice.mode && themePreset == choice.preset
                        FilterChip(
                            selected = selected,
                            onClick = {
                                scope.launch {
                                    preferencesManager.setThemeMode(choice.mode)
                                    preferencesManager.setThemePreset(choice.preset)
                                }
                            },
                            label = { Text(choice.label) }
                        )
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
