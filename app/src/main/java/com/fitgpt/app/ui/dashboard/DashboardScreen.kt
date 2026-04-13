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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.recommendationSourceLabel
import com.fitgpt.app.ui.common.weatherStatusBadge
import com.fitgpt.app.ui.common.weatherStatusMessage
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WeatherRequestSource
import com.fitgpt.app.viewmodel.WeatherStatusType
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val WEATHER_LOG_TAG = "FitGPTWeather"
private const val LOCATION_LOG_TAG = "FitGPTLocation"

@Composable
fun DashboardScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val recommendationState by viewModel.recommendationState.collectAsState()
    val recommendationMeta by viewModel.recommendationMeta.collectAsState()
    val plannedState by viewModel.plannedState.collectAsState()
    val weatherState by viewModel.weatherState.collectAsState()
    val weatherCity by viewModel.weatherCityState.collectAsState()
    val weatherUiStatus by viewModel.weatherUiStatus.collectAsState()
    val wardrobeGapState by viewModel.wardrobeGapState.collectAsState()
    val underusedAlertsState by viewModel.underusedAlertsState.collectAsState()
    var autoFetchAttempted by rememberSaveable { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val locationProvider = remember(context) { GpsLocationProvider(context) }

    fun fetchFromCurrentLocation() {
        scope.launch {
            Log.i(LOCATION_LOG_TAG, "location weather fetch requested")
            val locationContext = locationProvider.getCurrentLocationContext()
            if (locationContext == null) {
                viewModel.markWeatherManualFallback()
                Log.w(LOCATION_LOG_TAG, "location unavailable for weather fetch")
                return@launch
            }
            locationContext.city?.let { viewModel.setWeatherCityInput(it) }
            viewModel.fetchWeather(
                city = locationContext.city,
                lat = locationContext.lat,
                lon = locationContext.lon,
                source = WeatherRequestSource.LOCATION
            )
            Log.i(LOCATION_LOG_TAG, "location weather fetch started with coordinates")
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
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

    LaunchedEffect(Unit) {
        TopLevelReselectBus.events.collectLatest { route ->
            if (route != Routes.DASHBOARD) return@collectLatest
            viewModel.fetchRecommendations()
        }
    }

    val nextPlannedOutfit = remember(plannedState) {
        val today = java.time.LocalDate.now().toString()
        plannedState
            .filter { it.planDate >= today }
            .sortedBy { it.planDate }
            .firstOrNull()
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
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
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
                    val resolvedWeatherCity = (weatherState as? UiState.Success)?.data?.city ?: weatherCity
                    WebBadge(text = weatherStatusBadge(weatherUiStatus.type))
                    Text(
                        text = weatherStatusMessage(weatherUiStatus.type, resolvedWeatherCity),
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
                                if (weather.available && weather.temperatureF != null) {
                                    Text(
                                        text = listOfNotNull(
                                            weather.city,
                                            "${weather.temperatureF}F",
                                            weather.condition
                                        ).joinToString(" • "),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    weather.description?.let { description ->
                                        Text(
                                            text = description,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                } else {
                                    Text(
                                        text = "Weather unavailable right now",
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
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
                                onClick = {
                                    locationPermissionLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                        )
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Enable Location")
                            }
                        }
                        WeatherStatusType.MANUAL_CITY_FALLBACK,
                        WeatherStatusType.LOCATION_READY_WEATHER_UNAVAILABLE,
                        WeatherStatusType.STALE_WEATHER,
                        WeatherStatusType.UNAVAILABLE,
                        WeatherStatusType.IDLE -> {
                            if (weatherUiStatus.type != WeatherStatusType.IDLE) {
                                Button(
                                    onClick = { fetchFromCurrentLocation() },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Try current location again")
                                }
                            }
                            OutlinedTextField(
                                value = weatherCity,
                                onValueChange = { viewModel.setWeatherCityInput(it) },
                                label = { Text("City") },
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
                                Text("Use city weather")
                            }
                        }
                        else -> {
                            Button(
                                onClick = { fetchFromCurrentLocation() },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Use Current Location")
                            }
                        }
                    }
                }
            }

            nextPlannedOutfit?.let { plan ->
                WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Upcoming Plan", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "${plan.planDate} • ${plan.occasion ?: "Planned look"}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            text = "Items: ${plan.items.size}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Button(
                            onClick = { navController.navigateToSecondary(Routes.PLANS) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Open Plans")
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
                            navController.navigateToSecondary(Routes.RECOMMENDATION)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Get Outfit Recommendation")
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Wardrobe Gaps", style = MaterialTheme.typography.titleMedium)
                    when (val state = wardrobeGapState) {
                        UiState.Loading -> {
                            Text(
                                text = "Checking missing categories...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        is UiState.Success -> {
                            val gap = state.data
                            if (gap == null) {
                                Text(
                                    text = "Gap insights will appear after sync.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else if (gap.missingCategories.isEmpty()) {
                                Text(
                                    text = "Your core wardrobe categories are covered.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else {
                                Text(
                                    text = "Missing: ${gap.missingCategories.joinToString(", ")}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                                gap.suggestions.take(2).forEach { suggestion ->
                                    Text(
                                        text = "${suggestion.itemName} (${suggestion.category})",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    Text(
                                        text = suggestion.reason,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (gap.insufficientData) {
                                    Text(
                                        text = "Add a few more items for stronger gap detection.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
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
                    Button(
                        onClick = { viewModel.fetchWardrobeGaps() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Refresh Gap Insights")
                    }
                }
            }

            if (recommendationMeta.explanation.isNotBlank()) {
                WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Latest Recommendation Context", style = MaterialTheme.typography.titleMedium)
                        WebBadge(
                            text = recommendationSourceLabel(
                                source = recommendationMeta.source,
                                fallbackUsed = recommendationMeta.fallbackUsed
                            )
                        )
                        Text(
                            text = recommendationMeta.explanation,
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
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Refresh Recommendation")
                        }
                    }
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Underused Items", style = MaterialTheme.typography.titleMedium)
                    when (val state = underusedAlertsState) {
                        UiState.Loading -> {
                            Text(
                                text = "Analyzing wardrobe usage...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        is UiState.Success -> {
                            val alerts = state.data?.alerts.orEmpty()
                            if (alerts.isEmpty()) {
                                Text(
                                    text = "No underused clothing alerts right now.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else {
                                alerts.take(3).forEach { alert ->
                                    val timing = alert.daysSinceWorn?.let { "$it day(s) ago" } ?: "Never worn yet"
                                    Text(
                                        text = "${alert.itemName} • ${alert.category} • $timing",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
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
                    Button(
                        onClick = { viewModel.fetchUnderusedAlerts() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Refresh Alerts")
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
                            onClick = { navController.navigateToSecondary(Routes.ADD_ITEM) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Outfits",
                            subtitle = "Reuse saved looks",
                            onClick = { navController.navigateToSecondary(Routes.SAVED_OUTFITS) }
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Plans",
                            subtitle = "Schedule looks",
                            onClick = { navController.navigateToSecondary(Routes.PLANS) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Insights",
                            subtitle = "Review history",
                            onClick = { navController.navigateToSecondary(Routes.HISTORY) }
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "Chat",
                            subtitle = "Ask AURA",
                            onClick = { navController.navigateToSecondary(Routes.CHAT) }
                        )
                        QuickActionCard(
                            modifier = Modifier.weight(1f),
                            title = "More",
                            subtitle = "Favorites and settings",
                            onClick = { navController.navigateToSecondary(Routes.MORE) }
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
