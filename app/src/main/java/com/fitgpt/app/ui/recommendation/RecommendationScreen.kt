@file:OptIn(ExperimentalMaterial3Api::class)

package com.fitgpt.app.ui.recommendation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.fitgpt.app.data.model.OutfitRecommendation
import com.fitgpt.app.viewmodel.RecommendationUiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

@Composable
fun RecommendationScreen(
    navController: NavController,
    viewModel: WardrobeViewModel = viewModel()
) {
    val uiState by viewModel.recommendationState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Outfit Recommendation") },
                actions = {
                    IconButton(onClick = { viewModel.refreshRecommendations() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        }
    ) { paddingValues ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            when (val state = uiState) {
                is RecommendationUiState.Loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Getting AI recommendations...",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }

                is RecommendationUiState.Success -> {
                    if (state.recommendations.isEmpty()) {
                        Text(
                            text = "Add items to your wardrobe to get recommendations.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Recommended for you",
                                style = MaterialTheme.typography.headlineSmall
                            )
                            if (state.isAiGenerated) {
                                AssistChip(
                                    onClick = {},
                                    label = { Text("AI-powered") }
                                )
                            } else {
                                AssistChip(
                                    onClick = {},
                                    label = { Text("Offline") }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(state.recommendations) { recommendation ->
                                RecommendationCard(recommendation = recommendation)
                            }
                        }
                    }
                }

                is RecommendationUiState.Error -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(16.dp)
                                .fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "AI unavailable. Showing offline recommendations.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            OutlinedButton(onClick = { viewModel.refreshRecommendations() }) {
                                Text("Retry")
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (state.fallbackRecommendations.isNotEmpty()) {
                        Text(
                            text = "Recommended for you",
                            style = MaterialTheme.typography.headlineSmall
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(state.fallbackRecommendations) { recommendation ->
                                RecommendationCard(recommendation = recommendation)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { navController.popBackStack() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Back to Wardrobe")
            }
        }
    }
}

@Composable
private fun RecommendationCard(recommendation: OutfitRecommendation) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = recommendation.items.joinToString(" + ") {
                    "${it.color} ${it.category}"
                },
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (recommendation.score / 3.0).toFloat().coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = recommendation.explanation,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
