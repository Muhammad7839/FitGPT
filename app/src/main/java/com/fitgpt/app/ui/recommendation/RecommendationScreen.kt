@file:OptIn(ExperimentalMaterial3Api::class)

package com.fitgpt.app.ui.recommendation

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.NavController
import com.fitgpt.app.data.location.GpsLocationProvider
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.ui.common.FormOptionCatalog
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SelectableField
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.recommendationScoreLabel
import com.fitgpt.app.ui.common.recommendationSourceLabel
import com.fitgpt.app.ui.common.recommendationWarningLabel
import com.fitgpt.app.ui.common.weatherStatusMessage
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WeatherRequestSource
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val LOCATION_LOG_TAG = "FitGPTLocation"

@Composable
fun RecommendationScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val state by viewModel.recommendationState.collectAsState()
    val recommendationMeta by viewModel.recommendationMeta.collectAsState()
    val recommendationOptions by viewModel.recommendationOptionsState.collectAsState()
    val weatherState by viewModel.weatherState.collectAsState()
    val weatherCity by viewModel.weatherCityState.collectAsState()
    val weatherUiStatus by viewModel.weatherUiStatus.collectAsState()
    var manualTempInput by rememberSaveable { mutableStateOf("") }
    var weatherCategorySelection by rememberSaveable { mutableStateOf("") }
    var weatherCategoryCustom by rememberSaveable { mutableStateOf("") }
    var timeContext by rememberSaveable { mutableStateOf("") }
    var planDate by rememberSaveable { mutableStateOf("") }
    var exclude by rememberSaveable { mutableStateOf("") }
    var occasionSelection by rememberSaveable { mutableStateOf("") }
    var occasionCustom by rememberSaveable { mutableStateOf("") }
    var styleSelection by rememberSaveable { mutableStateOf("") }
    var styleCustom by rememberSaveable { mutableStateOf("") }
    var seasonSelection by rememberSaveable { mutableStateOf("") }
    var seasonCustom by rememberSaveable { mutableStateOf("") }
    var showAdvancedControls by rememberSaveable { mutableStateOf(false) }
    var selectedOptionIndex by rememberSaveable { mutableStateOf(0) }
    var locationMessage by rememberSaveable { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val gpsLocationProvider = remember(context) { GpsLocationProvider(context) }

    fun applyContextRequest(
        city: String?,
        lat: Double?,
        lon: Double?
    ) {
        val resolvedOccasion = occasionSelection.resolveSelectedValue(occasionCustom)
        val resolvedStylePreference = styleSelection.resolveSelectedValue(styleCustom)
        val resolvedWeatherCategory = weatherCategorySelection
            .resolveSelectedValue(weatherCategoryCustom)
            .toBackendWeatherCategoryOrNull()
        val resolvedSeason = seasonSelection.resolveSelectedValue(seasonCustom)
        val preferredSeasons = if (resolvedSeason.isNullOrBlank()) {
            listOf(currentSeasonTag())
        } else {
            listOf(resolvedSeason.lowercase())
        }

        city?.trim()?.takeIf { it.isNotEmpty() }?.let { viewModel.setWeatherCityInput(it) }

        if (lat != null && lon != null) {
            viewModel.fetchWeather(lat = lat, lon = lon, source = WeatherRequestSource.LOCATION)
        } else if (city != null) {
            viewModel.fetchWeather(city = city, source = WeatherRequestSource.MANUAL_CITY)
        }

        viewModel.fetchRecommendations(
            manualTemp = manualTempInput.trim().toIntOrNull(),
            timeContext = timeContext.nullIfBlank(),
            planDate = planDate.nullIfBlank(),
            exclude = exclude.nullIfBlank(),
            weatherCity = city,
            weatherLat = lat,
            weatherLon = lon,
            weatherCategory = resolvedWeatherCategory,
            occasion = resolvedOccasion,
            stylePreference = resolvedStylePreference,
            preferredSeasons = preferredSeasons
        )
    }

    fun loadUsingCurrentLocation() {
        scope.launch {
            locationMessage = "Detecting location..."
            Log.i(LOCATION_LOG_TAG, "recommendation screen location requested")
            val locationContext = gpsLocationProvider.getCurrentLocationContext()
            if (locationContext == null) {
                locationMessage = "Location unavailable. You can still use city manually."
                viewModel.markWeatherManualFallback()
                Log.w(LOCATION_LOG_TAG, "recommendation location unavailable")
                return@launch
            }
            val cityLabel = locationContext.city?.takeIf { it.isNotBlank() }
            locationMessage = cityLabel?.let { "Using current location: $it" } ?: "Using current location weather."
            cityLabel?.let { viewModel.setWeatherCityInput(it) }
            Log.i(LOCATION_LOG_TAG, "recommendation location resolved")
            applyContextRequest(city = cityLabel, lat = locationContext.lat, lon = locationContext.lon)
        }
    }

    fun submitFeedbackAndRefresh(signal: String) {
        viewModel.submitRecommendationFeedback(signal)
        applyContextRequest(
            city = weatherCity.nullIfBlank(),
            lat = null,
            lon = null
        )
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            loadUsingCurrentLocation()
        } else {
            locationMessage = "Location permission denied."
            viewModel.markWeatherPermissionNeeded()
            Log.w(LOCATION_LOG_TAG, "recommendation location permission denied")
        }
    }

    LaunchedEffect(Unit) {
        viewModel.fetchRecommendations()
    }

    LaunchedEffect(recommendationOptions) {
        if (recommendationOptions.isEmpty()) {
            selectedOptionIndex = 0
            return@LaunchedEffect
        }
        if (selectedOptionIndex !in recommendationOptions.indices) {
            selectedOptionIndex = 0
        }
        viewModel.selectRecommendationOption(selectedOptionIndex)
    }

    LaunchedEffect(Unit) {
        TopLevelReselectBus.events.collectLatest { route ->
            if (route != Routes.RECOMMENDATION) return@collectLatest
            applyContextRequest(
                city = weatherCity.nullIfBlank(),
                lat = null,
                lon = null
            )
        }
    }

    when (state) {

        is UiState.Loading -> {
            FitGptScaffold(
                navController = navController,
                currentRoute = Routes.RECOMMENDATION,
                title = "Outfit Recommendation"
            ) { paddingValues ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        }

        is UiState.Error -> {
            FitGptScaffold(
                navController = navController,
                currentRoute = Routes.RECOMMENDATION,
                title = "Outfit Recommendation"
            ) { paddingValues ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = (state as UiState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                    Button(
                        onClick = { viewModel.fetchRecommendations() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Retry")
                    }
                }
            }
        }

        is UiState.Success -> {

            val recommendedItems = (state as UiState.Success<List<ClothingItem>>).data

            FitGptScaffold(
                navController = navController,
                currentRoute = Routes.RECOMMENDATION,
                title = "Outfit Recommendation"
            ) { paddingValues ->

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(16.dp)
                        .verticalScroll(rememberScrollState())
                ) {

                    SectionHeader(
                        title = "Recommended for you",
                        subtitle = "Live context + wardrobe history driven picks"
                    )
                    if (recommendedItems.isNotEmpty()) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            WebBadge(
                                text = recommendationSourceLabel(
                                    source = recommendationMeta.source,
                                    fallbackUsed = recommendationMeta.fallbackUsed
                                )
                            )
                            recommendationWarningLabel(recommendationMeta.warning)?.let { warningLabel ->
                                WebBadge(text = warningLabel)
                            }
                            recommendationScoreLabel(
                                score = recommendationMeta.outfitScore,
                                fallbackUsed = recommendationMeta.fallbackUsed
                            )?.let { scoreLabel ->
                                WebBadge(text = scoreLabel)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    recommendationMeta.explanation.takeIf { it.isNotBlank() }?.let { summary ->
                        WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "Why this outfit was recommended",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                buildRecommendationReasons(
                                    summary = summary,
                                    weatherState = weatherState,
                                    occasion = occasionSelection.resolveSelectedValue(occasionCustom),
                                    stylePreference = styleSelection.resolveSelectedValue(styleCustom),
                                    recommendedItems = recommendedItems
                                ).forEach { reason ->
                                    Text(
                                        text = "• $reason",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    recommendationMeta.promptFeedback?.takeIf { it.shouldPrompt }?.let { promptMeta ->
                        WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "Quick feedback",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Text(
                                    text = "Was this recommendation useful for your style?",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    TextButton(onClick = { viewModel.recordPromptInteraction("accepted") }) {
                                        Text("Yes")
                                    }
                                    TextButton(onClick = { viewModel.recordPromptInteraction("ignored") }) {
                                        Text("Not now")
                                    }
                                }
                                if (promptMeta.cooldownSecondsRemaining > 0) {
                                    Text(
                                        text = "Prompt cooldown active.",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    WebCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Context controls",
                                style = MaterialTheme.typography.titleSmall
                            )

                            OutlinedTextField(
                                value = weatherCity,
                                onValueChange = { viewModel.setWeatherCityInput(it) },
                                label = { Text("Weather city") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            SelectableField(
                                label = "Occasion",
                                selectedValue = occasionSelection,
                                onValueChange = { occasionSelection = it },
                                options = FormOptionCatalog.recommendationOccasions,
                                customValue = occasionCustom,
                                onCustomValueChange = { occasionCustom = it }
                            )

                            OutlinedButton(
                                onClick = { showAdvancedControls = !showAdvancedControls },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    if (showAdvancedControls) {
                                        "Hide advanced controls"
                                    } else {
                                        "Show advanced controls"
                                    }
                                )
                            }

                            if (showAdvancedControls) {
                                OutlinedTextField(
                                    value = manualTempInput,
                                    onValueChange = { manualTempInput = it },
                                    label = { Text("Manual temperature (F)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                SelectableField(
                                    label = "Weather preference",
                                    selectedValue = weatherCategorySelection,
                                    onValueChange = { weatherCategorySelection = it },
                                    options = FormOptionCatalog.weatherCategoryOptions,
                                    customValue = weatherCategoryCustom,
                                    onCustomValueChange = { weatherCategoryCustom = it }
                                )
                                OutlinedTextField(
                                    value = timeContext,
                                    onValueChange = { timeContext = it },
                                    label = { Text("Time context (morning/evening)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = planDate,
                                    onValueChange = { planDate = it },
                                    label = { Text("Plan date (YYYY-MM-DD)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = exclude,
                                    onValueChange = { exclude = it },
                                    label = { Text("Exclude keywords (comma-separated)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                SelectableField(
                                    label = "Style preference",
                                    selectedValue = styleSelection,
                                    onValueChange = { styleSelection = it },
                                    options = FormOptionCatalog.recommendationStyles,
                                    customValue = styleCustom,
                                    onCustomValueChange = { styleCustom = it }
                                )
                                SelectableField(
                                    label = "Season",
                                    selectedValue = seasonSelection,
                                    onValueChange = { seasonSelection = it },
                                    options = FormOptionCatalog.seasonOptions,
                                    customValue = seasonCustom,
                                    onCustomValueChange = { seasonCustom = it }
                                )
                            }

                            OutlinedButton(
                                onClick = {
                                    applyContextRequest(
                                        city = weatherCity.nullIfBlank(),
                                        lat = null,
                                        lon = null
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Apply context")
                            }

                            OutlinedButton(
                                onClick = {
                                    val hasPermission = ContextCompat.checkSelfPermission(
                                        context,
                                        Manifest.permission.ACCESS_FINE_LOCATION
                                    ) == PackageManager.PERMISSION_GRANTED ||
                                        ContextCompat.checkSelfPermission(
                                            context,
                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                        ) == PackageManager.PERMISSION_GRANTED

                                    if (hasPermission) {
                                        loadUsingCurrentLocation()
                                    } else {
                                        locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.LocationOn, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Use Current Location")
                            }

                            locationMessage?.let { message ->
                                Text(
                                    text = message,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = weatherStatusMessage(
                                    type = weatherUiStatus.type,
                                    resolvedCity = (weatherState as? UiState.Success)?.data?.city ?: weatherCity
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    when (val currentWeather = weatherState) {
                        UiState.Loading -> {
                            Text(
                                text = "Loading weather...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        is UiState.Error -> {
                            Text(
                                text = currentWeather.message,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                        is UiState.Success -> {
                            val weather = currentWeather.data
                            if (weather != null) {
                                WebCard(modifier = Modifier.fillMaxWidth()) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(
                                            text = "Live Weather • ${weather.city}",
                                            style = MaterialTheme.typography.titleSmall
                                        )
                                        Text(
                                            text = "${weather.temperatureF}F • ${weather.condition} • ${weather.weatherCategory}",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                        Text(
                                            text = weather.description,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                        }
                    }

                    if (recommendedItems.isEmpty()) {
                        WebCard(
                            modifier = Modifier.fillMaxWidth(),
                            accentTop = false
                        ) {
                            Text(
                                text = "No recommendation yet. Tap Apply context or Use Current Location.",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    } else {
                        if (recommendationOptions.size > 1) {
                            WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text("Outfit options", style = MaterialTheme.typography.titleSmall)
                                    recommendationOptions.take(3).forEachIndexed { index, option ->
                                        OutlinedButton(
                                            onClick = {
                                                selectedOptionIndex = index
                                                viewModel.selectRecommendationOption(index)
                                            },
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            val selected = if (index == selectedOptionIndex) " (selected)" else ""
                                            Text(
                                                "Option ${index + 1} • Confidence ${"%.2f".format(option.outfitScore)}$selected"
                                            )
                                        }
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                        }
                        Column(
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            recommendedItems.forEach { item ->
                                RecommendationCard(
                                    item = item,
                                    explanation = viewModel.generateExplanation(item)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    if (recommendedItems.isNotEmpty() && !recommendationMeta.suggestionId.isNullOrBlank()) {
                        WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Quick feedback",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = { submitFeedbackAndRefresh("like") },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Like")
                                    }
                                    OutlinedButton(
                                        onClick = { submitFeedbackAndRefresh("dislike") },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Not for me")
                                    }
                                    OutlinedButton(
                                        onClick = { submitFeedbackAndRefresh("reject") },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Hide")
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    Button(
                        onClick = {
                            if (recommendedItems.isEmpty()) return@Button
                            viewModel.markOutfitAsWorn(recommendedItems)
                            navController.navigateToSecondary(Routes.HISTORY)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty()
                    ) {
                        Text("Wear This Outfit")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            if (recommendedItems.isEmpty()) return@Button
                            viewModel.saveOutfit(recommendedItems)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty()
                    ) {
                        Icon(Icons.Default.Star, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save Outfit")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = {
                            if (recommendedItems.isEmpty()) return@OutlinedButton
                            viewModel.rejectCurrentRecommendation()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty()
                    ) {
                        Text("Not for me")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            if (recommendedItems.isEmpty()) return@Button
                            val today = java.time.LocalDate.now().plusDays(1).toString()
                            viewModel.planCurrentRecommendation(today, "Planned from recommendation")
                            navController.navigateToSecondary(Routes.PLANS)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty()
                    ) {
                        Icon(Icons.Default.DateRange, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Plan for Tomorrow")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = {
                            applyContextRequest(
                                city = weatherCity.nullIfBlank(),
                                lat = null,
                                lon = null
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Refresh Recommendation")
                    }
                }
            }
        }
    }
}

private fun String.nullIfBlank(): String? {
    val cleaned = trim()
    return if (cleaned.isEmpty()) null else cleaned
}

private fun String.resolveSelectedValue(customValue: String): String? {
    val selected = trim()
    if (selected.isEmpty()) return null
    if (selected.equals(FormOptionCatalog.OTHER_OPTION, ignoreCase = true)) {
        return customValue.nullIfBlank()
    }
    return selected
}

private fun String?.toBackendWeatherCategoryOrNull(): String? {
    val normalized = this?.trim()?.lowercase()
    return when (normalized) {
        "cold", "cool", "mild", "warm", "hot" -> normalized
        else -> null
    }
}

private fun currentSeasonTag(): String {
    return when (java.time.LocalDate.now().monthValue) {
        12, 1, 2 -> "winter"
        3, 4, 5 -> "spring"
        6, 7, 8 -> "summer"
        else -> "fall"
    }
}

private fun buildRecommendationReasons(
    summary: String,
    weatherState: UiState<*>,
    occasion: String?,
    stylePreference: String?,
    recommendedItems: List<ClothingItem>
): List<String> {
    val reasons = mutableListOf<String>()
    val weather = (weatherState as? UiState.Success<*>)?.data as? com.fitgpt.app.data.model.WeatherSnapshot
    if (weather != null) {
        reasons += "Weather is ${weather.temperatureF}°F in ${weather.city}"
    }
    occasion?.takeIf { it.isNotBlank() }?.let { reasons += "Occasion preference: $it" }
    stylePreference?.takeIf { it.isNotBlank() }?.let { reasons += "Style preference: $it" }
    if (recommendedItems.isNotEmpty()) {
        reasons += "${recommendedItems.size} available wardrobe items were matched"
    }
    reasons += summary
    return reasons
}

@Composable
private fun RecommendationCard(
    item: ClothingItem,
    explanation: String
) {
    WebCard(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RemoteImagePreview(
                imageUrl = item.imageUrl,
                contentDescription = item.category,
                modifier = Modifier.size(72.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "${item.category} • ${item.color}",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = explanation,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
