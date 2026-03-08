package com.fitgpt.app.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

/**
 * Dashboard entry mirroring the web home: recommendation controls + quick nav.
 */
@Composable
fun DashboardScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val recommendationState by viewModel.recommendationState.collectAsState()
    val weatherState by viewModel.weatherState.collectAsState()
    var manualTemp by remember { mutableStateOf("") }
    var timeContext by remember { mutableStateOf("") }
    var weatherCity by remember { mutableStateOf("") }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.DASHBOARD,
        title = "Dashboard"
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionHeader(
                title = "Dashboard",
                subtitle = "Build recommendations from your wardrobe and recent activity."
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val weatherLabel = when (val state = weatherState) {
                    UiState.Loading -> "Detecting weather..."
                    is UiState.Success -> {
                        val data = state.data
                        if (data == null) "Weather not set" else "${data.temperatureF}F • ${data.condition}"
                    }
                    is UiState.Error -> "Weather unavailable"
                }
                WebBadge(text = weatherLabel)
                if (timeContext.isNotBlank()) {
                    WebBadge(
                        text = "Time: ${timeContext.trim()}",
                        background = MaterialTheme.colorScheme.secondary.copy(alpha = 0.16f)
                    )
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Recommendation Inputs", style = MaterialTheme.typography.titleMedium)

                    OutlinedTextField(
                        value = manualTemp,
                        onValueChange = { manualTemp = it },
                        label = { Text("Manual temperature (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = timeContext,
                        onValueChange = { timeContext = it },
                        label = { Text("Time context (morning/afternoon/night)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = weatherCity,
                        onValueChange = { weatherCity = it },
                        label = { Text("Weather city (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            val city = weatherCity.trim().ifEmpty { null }
                            if (city != null) {
                                viewModel.fetchWeather(city)
                            }
                            viewModel.fetchRecommendations(
                                manualTemp = manualTemp.toIntOrNull(),
                                timeContext = timeContext.takeIf { it.isNotBlank() },
                                weatherCity = city
                            )
                            navController.navigate(Routes.RECOMMENDATION)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Get Outfit Recommendation")
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Quick Actions", style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Add Item",
                            subtitle = "Capture wardrobe",
                            onClick = { navController.navigate(Routes.ADD_ITEM) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Saved",
                            subtitle = "Reuse outfits",
                            onClick = { navController.navigate(Routes.SAVED_OUTFITS) }
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Plans",
                            subtitle = "Schedule looks",
                            onClick = { navController.navigate(Routes.PLANS) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "History",
                            subtitle = "Track wear",
                            onClick = { navController.navigate(Routes.HISTORY) }
                        )
                    }
                }
            }

            when (val state = recommendationState) {
                is UiState.Success -> {
                    if (state.data.isNotEmpty()) {
                        Text(
                            text = "Latest recommendation: ${state.data.joinToString { it.category }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                is UiState.Error -> {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                UiState.Loading -> {
                    Spacer(modifier = Modifier.height(2.dp))
                }
            }

            when (val state = weatherState) {
                UiState.Loading -> {
                    Text(
                        text = "Loading weather...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                is UiState.Error -> {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                is UiState.Success -> {
                    state.data?.let { weather ->
                        Text(
                            text = "Weather: ${weather.city} • ${weather.temperatureF}F • ${weather.condition}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickActionCard(
    modifier: Modifier = Modifier,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    WebCard(
        modifier = modifier,
        onClick = onClick,
        accentTop = false
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
