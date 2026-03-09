/**
 * Dashboard home focused on weather trust, quick recommendation access, and key shortcuts.
 */
package com.fitgpt.app.ui.dashboard

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.NavController
import com.fitgpt.app.data.location.GpsLocationProvider
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WeatherRequestSource
import com.fitgpt.app.viewmodel.WeatherStatusType
import kotlinx.coroutines.launch

private const val WEATHER_LOG_TAG = "FitGPTWeather"
private const val LOCATION_LOG_TAG = "FitGPTLocation"

@Composable
fun DashboardScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val recommendationState by viewModel.recommendationState.collectAsState()
    val weatherState by viewModel.weatherState.collectAsState()
    val weatherUiStatus by viewModel.weatherUiStatus.collectAsState()
    var weatherCity by rememberSaveable { mutableStateOf("") }
    var autoFetchAttempted by rememberSaveable { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val locationProvider = remember(context) { GpsLocationProvider(context) }

    fun fetchFromCurrentLocation() {
        scope.launch {
            Log.i(LOCATION_LOG_TAG, "location weather fetch requested")
            val coordinates = locationProvider.getCurrentCoordinates()
            if (coordinates == null) {
                viewModel.markWeatherManualFallback()
                Log.w(LOCATION_LOG_TAG, "location unavailable for weather fetch")
                return@launch
            }
            viewModel.fetchWeather(
                lat = coordinates.lat,
                lon = coordinates.lon,
                source = WeatherRequestSource.LOCATION
            )
            Log.i(LOCATION_LOG_TAG, "location weather fetch started with coordinates")
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            fetchFromCurrentLocation()
        } else {
            viewModel.markWeatherPermissionNeeded()
            Log.w(LOCATION_LOG_TAG, "location permission denied from dashboard")
        }
    }

    LaunchedEffect(Unit) {
        if (autoFetchAttempted) return@LaunchedEffect
        autoFetchAttempted = true

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasPermission) {
            Log.i(LOCATION_LOG_TAG, "dashboard auto weather fetch with location permission")
            fetchFromCurrentLocation()
        } else {
            viewModel.markWeatherPermissionNeeded()
            Log.i(LOCATION_LOG_TAG, "dashboard location permission missing")
        }
    }

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
                subtitle = "Your daily outfit planning starts here."
            )

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Weather", style = MaterialTheme.typography.titleMedium)
                    WebBadge(text = weatherStatusLabel(weatherUiStatus.type))
                    Text(
                        text = weatherUiStatus.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    when (val state = weatherState) {
                        UiState.Loading -> {
                            Text(
                                text = "Updating weather...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        is UiState.Success -> {
                            state.data?.let { weather ->
                                Text(
                                    text = "${weather.city} • ${weather.temperatureF}F • ${weather.condition}",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = weather.description,
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
                    }

                    when (weatherUiStatus.type) {
                        WeatherStatusType.PERMISSION_NEEDED -> {
                            Button(
                                onClick = { locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Enable Location Weather")
                            }
                        }
                        WeatherStatusType.MANUAL_CITY_FALLBACK,
                        WeatherStatusType.UNAVAILABLE,
                        WeatherStatusType.IDLE -> {
                            OutlinedTextField(
                                value = weatherCity,
                                onValueChange = { weatherCity = it },
                                label = { Text("Weather city fallback") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    val city = weatherCity.trim()
                                    if (city.isNotEmpty()) {
                                        viewModel.fetchWeather(
                                            city = city,
                                            source = WeatherRequestSource.MANUAL_CITY
                                        )
                                    }
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Use City Weather")
                            }
                        }
                        else -> {
                            Button(
                                onClick = { fetchFromCurrentLocation() },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Refresh Location Weather")
                            }
                        }
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Recommendations", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Open Recommend for advanced controls, exclusions, and occasion tuning.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = {
                            val weather = (weatherState as? UiState.Success)?.data
                            viewModel.fetchRecommendations(
                                manualTemp = weather?.temperatureF,
                                weatherCategory = weather?.weatherCategory
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
                            title = "Plans",
                            subtitle = "Schedule looks",
                            onClick = { navController.navigate(Routes.PLANS) }
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Saved",
                            subtitle = "Reuse outfits",
                            onClick = { navController.navigate(Routes.SAVED_OUTFITS) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "More",
                            subtitle = "History and settings",
                            onClick = { navController.navigate(Routes.MORE) }
                        )
                    }
                }
            }

            when (val state = recommendationState) {
                is UiState.Success -> {
                    if (state.data.isNotEmpty()) {
                        Text(
                            text = "Latest recommendation ready.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                is UiState.Error -> {
                    Log.w(WEATHER_LOG_TAG, "recommendation state error visible=${state.message.isNotBlank()}")
                }
                UiState.Loading -> Unit
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

private fun weatherStatusLabel(status: WeatherStatusType): String {
    return when (status) {
        WeatherStatusType.LOADING -> "Loading"
        WeatherStatusType.USING_LOCATION -> "Using location"
        WeatherStatusType.PERMISSION_NEEDED -> "Permission needed"
        WeatherStatusType.MANUAL_CITY_FALLBACK -> "Manual city fallback"
        WeatherStatusType.UNAVAILABLE -> "Unavailable"
        WeatherStatusType.AVAILABLE -> "Ready"
        WeatherStatusType.IDLE -> "Not set"
    }
}
