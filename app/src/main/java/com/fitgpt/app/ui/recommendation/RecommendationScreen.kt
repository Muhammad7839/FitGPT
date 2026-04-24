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
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.weatherStatusMessage
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WeatherRequestSource
import com.fitgpt.app.viewmodel.WeatherStatusType
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val LOCATION_LOG_TAG = "LOCATION_DEBUG"
private const val WEATHER_DEBUG_LOG_TAG = "WEATHER_DEBUG"

@Composable
fun RecommendationScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val state by viewModel.recommendationState.collectAsState()
    val recommendationMeta by viewModel.recommendationMeta.collectAsState()
    val recommendationOptions by viewModel.recommendationOptionsState.collectAsState()
    val saveOutfitState by viewModel.saveOutfitState.collectAsState()
    val wearOutfitState by viewModel.wearOutfitState.collectAsState()
    val planRecommendationState by viewModel.planRecommendationState.collectAsState()
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
    val snackbarHostState = remember { SnackbarHostState() }
    val isSavingOutfit = saveOutfitState is UiState.Loading
    val isWearingOutfit = wearOutfitState is UiState.Loading
    val isPlanningRecommendation = planRecommendationState is UiState.Loading

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

        val hasFreshCoordinates = lat != null && lon != null
        val cachedCity = viewModel.getCachedWeatherCity()
        val resolvedCity = city?.trim()?.takeIf { it.isNotEmpty() }
            ?: if (hasFreshCoordinates) null else cachedCity
        val resolvedLat = if (resolvedCity == null) lat else null
        val resolvedLon = if (resolvedCity == null) lon else null

        resolvedCity?.let { viewModel.setWeatherCityInput(it) }
        viewModel.updateLocationDebugInfo(
            lat = lat,
            lon = lon,
            city = city?.trim()?.takeIf { it.isNotEmpty() } ?: resolvedCity
        )
        Log.d(WEATHER_DEBUG_LOG_TAG, "Using city=${resolvedCity.orEmpty()}")

        if (resolvedCity != null) {
            viewModel.fetchWeather(
                city = resolvedCity,
                source = if (lat != null && lon != null) WeatherRequestSource.LOCATION else WeatherRequestSource.MANUAL_CITY
            )
        } else if (resolvedLat != null && resolvedLon != null) {
            viewModel.fetchWeather(lat = resolvedLat, lon = resolvedLon, source = WeatherRequestSource.LOCATION)
        }

        viewModel.fetchRecommendations(
            manualTemp = manualTempInput.trim().toIntOrNull(),
            timeContext = timeContext.nullIfBlank(),
            planDate = planDate.nullIfBlank(),
            exclude = exclude.nullIfBlank(),
            weatherCity = resolvedCity,
            weatherLat = resolvedLat,
            weatherLon = resolvedLon,
            weatherCategory = resolvedWeatherCategory,
            occasion = resolvedOccasion,
            stylePreference = resolvedStylePreference,
            preferredSeasons = preferredSeasons
        )
    }

    fun loadUsingCurrentLocation() {
        scope.launch {
            locationMessage = "Detecting location..."
            Log.d(LOCATION_LOG_TAG, "recommendation screen location requested")
            val locationContext = gpsLocationProvider.getCurrentLocationContext()
            if (locationContext == null) {
                locationMessage = "Location unavailable. You can still use city manually."
                viewModel.markWeatherManualFallback()
                Log.w(LOCATION_LOG_TAG, "recommendation location unavailable")
                return@launch
            }
            Log.d(LOCATION_LOG_TAG, "lat=${locationContext.lat} lon=${locationContext.lon}")
            val cityLabel = locationContext.city?.takeIf { it.isNotBlank() }
            locationMessage = cityLabel?.let { "Using current location: $it" } ?: "Location found. Using coordinates while city resolves."
            cityLabel?.let { viewModel.setWeatherCityInput(it) }
            viewModel.updateLocationDebugInfo(
                lat = locationContext.lat,
                lon = locationContext.lon,
                city = cityLabel
            )
            Log.d(LOCATION_LOG_TAG, "recommendation location resolved")
            applyContextRequest(city = cityLabel, lat = locationContext.lat, lon = locationContext.lon)
        }
    }

    fun retryLocationWeather() {
        val cachedCity = viewModel.getCachedWeatherCity()?.takeIf { it.isNotBlank() }
        if (cachedCity != null) {
            locationMessage = "Retrying weather for $cachedCity..."
            applyContextRequest(city = cachedCity, lat = null, lon = null)
        } else {
            locationMessage = "Retrying location..."
            loadUsingCurrentLocation()
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

    LaunchedEffect(saveOutfitState) {
        when (val currentSaveState = saveOutfitState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                snackbarHostState.showSnackbar(currentSaveState.message)
                viewModel.clearSaveOutfitState()
            }
            is UiState.Success -> {
                if (currentSaveState.data == true) {
                    snackbarHostState.showSnackbar("Outfit saved to your collection.")
                    viewModel.clearSaveOutfitState()
                }
            }
        }
    }

    LaunchedEffect(wearOutfitState) {
        when (val currentWearState = wearOutfitState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                snackbarHostState.showSnackbar(currentWearState.message)
                viewModel.clearWearOutfitState()
            }
            is UiState.Success -> {
                if (currentWearState.data == true) {
                    viewModel.clearWearOutfitState()
                    navController.navigateToSecondary(Routes.HISTORY)
                }
            }
        }
    }

    LaunchedEffect(planRecommendationState) {
        when (val currentPlanState = planRecommendationState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                snackbarHostState.showSnackbar(currentPlanState.message)
                viewModel.clearPlanRecommendationState()
            }
            is UiState.Success -> {
                if (currentPlanState.data == true) {
                    viewModel.clearPlanRecommendationState()
                    navController.navigateToSecondary(Routes.PLANS)
                }
            }
        }
    }

    when (state) {

        is UiState.Loading -> {
            FitGptScaffold(
                navController = navController,
                currentRoute = Routes.RECOMMENDATION,
                title = "Outfit Recommendation",
                snackbarHost = { SnackbarHost(snackbarHostState) }
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
                title = "Outfit Recommendation",
                snackbarHost = { SnackbarHost(snackbarHostState) }
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
                title = "Outfit Recommendation",
                snackbarHost = { SnackbarHost(snackbarHostState) }
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
                        subtitle = "Built around your weather, plans, and saved style profile."
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    recommendationMeta.explanation.takeIf { it.isNotBlank() }?.let { summary ->
                        WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = "Why this works",
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

                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Recommendation context",
                                style = MaterialTheme.typography.titleSmall
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                WebBadge(text = "Source: ${recommendationMeta.source}")
                                WebBadge(text = "Score: ${String.format("%.2f", recommendationMeta.outfitScore)}")
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                recommendationMeta.weatherCategory?.takeIf { it.isNotBlank() }?.let {
                                    WebBadge(text = "Weather: $it")
                                }
                                recommendationMeta.occasion?.takeIf { it.isNotBlank() }?.let {
                                    WebBadge(text = "Occasion: $it")
                                }
                                if (recommendationMeta.fallbackUsed) {
                                    WebBadge(text = "Fallback")
                                }
                            }
                            recommendationMeta.warning?.takeIf { it.isNotBlank() }?.let { warning ->
                                Text(
                                    text = warning,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

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
                                text = "Adjust this look",
                                style = MaterialTheme.typography.titleSmall
                            )

                            OutlinedTextField(
                                value = weatherCity,
                                onValueChange = { viewModel.setWeatherCityInput(it) },
                                label = { Text("City") },
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
                                        "Hide extra options"
                                    } else {
                                        "Customize details"
                                    }
                                )
                            }

                            if (showAdvancedControls) {
                                OutlinedTextField(
                                    value = manualTempInput,
                                    onValueChange = { manualTempInput = it },
                                    label = { Text("Manual temperature (°F)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                SelectableField(
                                    label = "Temperature feel",
                                    selectedValue = weatherCategorySelection,
                                    onValueChange = { weatherCategorySelection = it },
                                    options = FormOptionCatalog.weatherCategoryOptions,
                                    customValue = weatherCategoryCustom,
                                    onCustomValueChange = { weatherCategoryCustom = it }
                                )
                                OutlinedTextField(
                                    value = timeContext,
                                    onValueChange = { timeContext = it },
                                    label = { Text("Time of day") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = planDate,
                                    onValueChange = { planDate = it },
                                    label = { Text("Planned date (YYYY-MM-DD)") },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                OutlinedTextField(
                                    value = exclude,
                                    onValueChange = { exclude = it },
                                    label = { Text("Avoid") },
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

                            if (
                                weatherUiStatus.type == WeatherStatusType.LOCATION_READY_WEATHER_UNAVAILABLE ||
                                weatherUiStatus.type == WeatherStatusType.UNAVAILABLE ||
                                weatherUiStatus.type == WeatherStatusType.STALE_WEATHER
                            ) {
                                OutlinedButton(
                                    onClick = { retryLocationWeather() },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Retry Weather")
                                }
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
                                        if (weather.available && weather.temperatureF != null) {
                                            Text(
                                                text = buildWeatherSummary(weather),
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                            weather.description?.takeIf { it.isNotBlank() }?.let { description ->
                                                Text(
                                                    text = description,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        } else {
                                            Text(
                                                text = "Weather is unavailable right now. Recommendations can still use season and occasion.",
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                        }
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
                                text = "Add at least a top, bottom, and shoes to unlock a full outfit suggestion. You can also tap Use Current Location to refresh around live conditions.",
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
                                            Text(
                                                buildOptionTitle(
                                                    index = index,
                                                    weatherCategory = recommendationMeta.weatherCategory,
                                                    occasion = recommendationMeta.occasion
                                                ) + if (index == selectedOptionIndex) " • Selected" else ""
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
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty() && !isWearingOutfit
                    ) {
                        Text(if (isWearingOutfit) "Saving Wear History..." else "Wear This Outfit")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            if (recommendedItems.isEmpty()) return@Button
                            viewModel.saveOutfit(recommendedItems)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty() && !isSavingOutfit
                    ) {
                        Icon(Icons.Default.Star, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isSavingOutfit) "Saving..." else "Save Outfit")
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
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = recommendedItems.isNotEmpty() && !isPlanningRecommendation
                    ) {
                        Icon(Icons.Default.DateRange, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isPlanningRecommendation) "Planning..." else "Plan for Tomorrow")
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

private fun buildOptionTitle(
    index: Int,
    weatherCategory: String?,
    occasion: String?
): String {
    val occasionText = occasion?.trim()?.takeIf { it.isNotEmpty() }
    val weatherText = weatherCategory?.trim()?.takeIf { it.isNotEmpty() }
    return when {
        occasionText != null -> "$occasionText option ${index + 1}"
        weatherText != null -> "${weatherText.replaceFirstChar { it.uppercase() }} option ${index + 1}"
        else -> "Option ${index + 1}"
    }
}

private fun buildWeatherSummary(weather: com.fitgpt.app.data.model.WeatherSnapshot): String {
    val temperature = weather.temperatureF?.let { "${it}°F" }
    val condition = weather.condition?.trim()?.takeIf { it.isNotEmpty() }
    return listOfNotNull(temperature, condition).joinToString(" • ")
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
