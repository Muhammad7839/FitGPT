@file:OptIn(ExperimentalMaterial3Api::class)

package com.fitgpt.app.ui.recommendation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.fitgpt.app.viewmodel.WardrobeViewModel

@Composable
fun RecommendationScreen(
    navController: NavController,
    viewModel: WardrobeViewModel = viewModel()
) {
    val items by viewModel.wardrobeItems.collectAsState()

    val recommendedItems = remember(items) {
        items.take(2)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Outfit Recommendation") },
                actions = {
                    IconButton(onClick = { /* recomposition refresh */ }) {
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

            if (recommendedItems.isEmpty()) {
                Text(
                    text = "Add items to your wardrobe to get recommendations.",
                    style = MaterialTheme.typography.bodyMedium
                )
                return@Column
            }

            Text(
                text = "Recommended for you",
                style = MaterialTheme.typography.headlineSmall
            )

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(recommendedItems) { item ->
                    RecommendationCard(
                        title = "${item.category} - ${item.color}",
                        explanation = viewModel.generateExplanation(item)
                    )
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
private fun RecommendationCard(
    title: String,
    explanation: String
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
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