package com.fitgpt.app.ui.saved

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.navigation.navigateToTopLevel
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

/**
 * Saved outfits mirror for reusable combinations.
 */
@Composable
fun SavedOutfitsScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val saved by viewModel.savedOutfitsState.collectAsState()
    val recommendationState by viewModel.recommendationState.collectAsState()

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.SAVED_OUTFITS,
        title = "Saved Outfits"
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionHeader(
                title = "Saved Outfits",
                subtitle = "Your favorite outfit combinations"
            )

            if (recommendationState is UiState.Success) {
                val current = (recommendationState as UiState.Success).data
                if (current.isNotEmpty()) {
                    Button(
                        onClick = { viewModel.saveOutfit(current) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Current Recommendation")
                    }
                }
            }

            if (saved.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    EmptyStateCard(
                        title = "No saved outfits yet",
                        subtitle = "Save a recommendation to see it here."
                    )
                    Button(
                        onClick = { navController.navigateToTopLevel(Routes.DASHBOARD) },
                        modifier = Modifier.padding(top = 12.dp)
                    ) {
                        Text("Go to Dashboard")
                    }
                }
                return@FitGptScaffold
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(saved) { outfit ->
                    WebCard(
                        modifier = Modifier.fillMaxWidth(),
                        accentTop = false
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = outfit.items.joinToString { it.category },
                                    style = MaterialTheme.typography.titleMedium
                                )
                                WebBadge(text = "Saved")
                            }
                            Text(
                                text = "Created from recommendation",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (outfit.note.isNotBlank()) {
                                Text(
                                    text = outfit.note,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                outfit.items.take(4).forEach { item ->
                                    RemoteImagePreview(
                                        imageUrl = item.imageUrl,
                                        contentDescription = item.category,
                                        modifier = Modifier.size(58.dp)
                                    )
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        viewModel.markOutfitAsWorn(outfit.items)
                                        navController.navigateToSecondary(Routes.HISTORY)
                                    }
                                ) {
                                    Text("Wear")
                                }
                                Button(onClick = { viewModel.removeSavedOutfit(outfit.id) }) {
                                    Text("Remove")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
