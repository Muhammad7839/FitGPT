package com.fitgpt.app.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.data.model.ThemeMode
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.viewmodel.ProfileViewModel
import com.fitgpt.app.viewmodel.UiState
import kotlinx.coroutines.launch

/**
 * Profile page with backend-backed user profile updates.
 */
@Composable
fun ProfileScreen(
    navController: NavController,
    viewModel: ProfileViewModel
) {
    val state by viewModel.profileState.collectAsState()
    val context = LocalContext.current
    val preferencesManager = remember { PreferencesManager(context) }
    val themeMode by preferencesManager.themeMode.collectAsState(initial = ThemeMode.SYSTEM)
    val scope = rememberCoroutineScope()

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.PROFILE,
        title = "Profile"
    ) { padding ->
        when (val currentState = state) {
            UiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(horizontal = 24.dp))
                }
            }

            is UiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(currentState.message, color = MaterialTheme.colorScheme.error)
                    Button(onClick = { viewModel.refresh() }) {
                        Text("Retry")
                    }
                }
            }

            is UiState.Success -> {
                val profile = currentState.data
                var bodyType by remember(profile.idHash()) { mutableStateOf(profile.bodyType) }
                var lifestyle by remember(profile.idHash()) { mutableStateOf(profile.lifestyle) }
                var comfort by remember(profile.idHash()) { mutableStateOf(profile.comfortPreference) }
                var onboardingComplete by remember(profile.idHash()) { mutableStateOf(profile.onboardingComplete) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SectionHeader(
                        title = "Profile",
                        subtitle = "Manage your account and preferences"
                    )

                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Appearance", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = "Match the web style with system, light, or dark mode.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(
                                    selected = themeMode == ThemeMode.SYSTEM,
                                    onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.SYSTEM) } },
                                    label = { Text("System") }
                                )
                                FilterChip(
                                    selected = themeMode == ThemeMode.LIGHT,
                                    onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.LIGHT) } },
                                    label = { Text("Light") }
                                )
                                FilterChip(
                                    selected = themeMode == ThemeMode.DARK,
                                    onClick = { scope.launch { preferencesManager.setThemeMode(ThemeMode.DARK) } },
                                    label = { Text("Dark") }
                                )
                            }
                        }
                    }

                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Signed in as ${profile.email}", style = MaterialTheme.typography.titleMedium)

                            OutlinedTextField(
                                value = bodyType,
                                onValueChange = { bodyType = it },
                                label = { Text("Body Type") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = lifestyle,
                                onValueChange = { lifestyle = it },
                                label = { Text("Lifestyle") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = comfort,
                                onValueChange = { comfort = it },
                                label = { Text("Comfort Preference") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Onboarding Complete")
                                Switch(
                                    checked = onboardingComplete,
                                    onCheckedChange = { onboardingComplete = it }
                                )
                            }

                            Button(
                                onClick = {
                                    viewModel.updateProfile(
                                        bodyType = bodyType,
                                        lifestyle = lifestyle,
                                        comfortPreference = comfort,
                                        onboardingComplete = onboardingComplete
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Save Profile")
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun com.fitgpt.app.data.model.UserProfile.idHash(): String {
    return "${email}_${bodyType}_${lifestyle}_${comfortPreference}_${onboardingComplete}"
}
