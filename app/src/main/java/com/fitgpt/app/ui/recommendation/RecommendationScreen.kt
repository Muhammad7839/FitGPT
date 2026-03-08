@file:OptIn(ExperimentalMaterial3Api::class)

package com.fitgpt.app.ui.recommendation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

@Composable
fun RecommendationScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val state by viewModel.recommendationState.collectAsState()
    val weatherState by viewModel.weatherState.collectAsState()
    var manualTempInput by rememberSaveable { mutableStateOf("") }
    var weatherCity by rememberSaveable { mutableStateOf("") }
    var weatherCategory by rememberSaveable { mutableStateOf("") }
    var timeContext by rememberSaveable { mutableStateOf("") }
    var planDate by rememberSaveable { mutableStateOf("") }
    var exclude by rememberSaveable { mutableStateOf("") }
    var occasion by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.fetchRecommendations()
    }

    when (state) {

        is UiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }

        is UiState.Error -> {
            Text(
                text = (state as UiState.Error).message,
                modifier = Modifier.padding(16.dp)
            )
        }

        is UiState.Success -> {

            val recommendedItems = (state as UiState.Success<List<ClothingItem>>).data

            FitGptScaffold(
                navController = navController,
                currentRoute = Routes.DASHBOARD,
                title = "Outfit Recommendation"
            ) { paddingValues ->

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(16.dp)
                ) {

                    if (recommendedItems.isEmpty()) {
                        Text(
                            text = "Add available items to generate an outfit.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        return@Column
                    }

                    SectionHeader(
                        title = "Recommended for you",
                        subtitle = "Live context + wardrobe history driven picks"
                    )

                    Spacer(modifier = Modifier.height(12.dp))

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
                                value = manualTempInput,
                                onValueChange = { manualTempInput = it },
                                label = { Text("Manual temperature (F)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = weatherCity,
                                onValueChange = { weatherCity = it },
                                label = { Text("Weather city (optional)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )
                            OutlinedTextField(
                                value = weatherCategory,
                                onValueChange = { weatherCategory = it },
                                label = { Text("Weather category (cold/cool/mild/warm/hot)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
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
                            OutlinedTextField(
                                value = occasion,
                                onValueChange = { occasion = it },
                                label = { Text("Occasion (work, gym, event)") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true
                            )

                            OutlinedButton(
                                onClick = {
                                    val city = weatherCity.nullIfBlank()
                                    if (city != null) {
                                        viewModel.fetchWeather(city)
                                    }
                                    viewModel.fetchRecommendations(
                                        manualTemp = manualTempInput.trim().toIntOrNull(),
                                        timeContext = timeContext.nullIfBlank(),
                                        planDate = planDate.nullIfBlank(),
                                        exclude = exclude.nullIfBlank(),
                                        weatherCity = city,
                                        weatherCategory = weatherCategory.nullIfBlank(),
                                        occasion = occasion.nullIfBlank()
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Apply context")
                            }
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

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(recommendedItems) { item ->
                            RecommendationCard(
                                item = item,
                                explanation = viewModel.generateExplanation(item)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Button(
                        onClick = {
                            viewModel.markOutfitAsWorn(recommendedItems)
                            navController.navigate(Routes.HISTORY)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Wear This Outfit")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = { viewModel.saveOutfit(recommendedItems) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Star, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save Outfit")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            val today = java.time.LocalDate.now().plusDays(1).toString()
                            viewModel.planCurrentRecommendation(today, "Planned from recommendation")
                            navController.navigate(Routes.PLANS)
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.DateRange, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Plan for Tomorrow")
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = {
                            val city = weatherCity.nullIfBlank()
                            if (city != null) {
                                viewModel.fetchWeather(city)
                            }
                            viewModel.fetchRecommendations(
                                manualTemp = manualTempInput.trim().toIntOrNull(),
                                timeContext = timeContext.nullIfBlank(),
                                planDate = planDate.nullIfBlank(),
                                exclude = exclude.nullIfBlank(),
                                weatherCity = city,
                                weatherCategory = weatherCategory.nullIfBlank(),
                                occasion = occasion.nullIfBlank()
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
