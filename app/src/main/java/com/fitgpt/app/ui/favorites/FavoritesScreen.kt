package com.fitgpt.app.ui.favorites

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

/**
 * Favorites list backed by local favorite toggles from the wardrobe state.
 */
@Composable
fun FavoritesScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val uiState by viewModel.wardrobeState.collectAsState()

    val items = (uiState as? UiState.Success<List<com.fitgpt.app.data.model.ClothingItem>>)
        ?.data
        .orEmpty()
        .filter { it.isFavorite && !it.isArchived }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.FAVORITES,
        title = "Favorites"
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionHeader(
                title = "Favorites",
                subtitle = "Your saved wardrobe items"
            )

        if (items.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                EmptyStateCard(
                    title = "No favorites yet",
                    subtitle = "Tap the heart icon on wardrobe items to pin them here."
                )
            }
            return@Column
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(items) { item ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RemoteImagePreview(
                            imageUrl = item.imageUrl,
                            contentDescription = item.category,
                            modifier = Modifier.size(74.dp)
                        )
                        Spacer(modifier = Modifier.size(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "${item.category} • ${item.color}",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "${item.season} • Comfort ${item.comfortLevel}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(onClick = { viewModel.toggleFavorite(item.id) }) {
                            Icon(
                                imageVector = if (item.isFavorite) {
                                    Icons.Default.Favorite
                                } else {
                                    Icons.Default.FavoriteBorder
                                },
                                contentDescription = "Toggle favorite"
                            )
                        }
                    }
                }
            }
        }
        }
    }
}
