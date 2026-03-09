/**
 * App-level settings screen with appearance controls separated from profile identity data.
 */
package com.fitgpt.app.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.data.model.ThemeMode
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
    val themeMode by preferencesManager.themeMode.collectAsState(initial = ThemeMode.DARK)
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
                .padding(horizontal = 20.dp, vertical = 12.dp),
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
                }
            }
        }
    }
}
