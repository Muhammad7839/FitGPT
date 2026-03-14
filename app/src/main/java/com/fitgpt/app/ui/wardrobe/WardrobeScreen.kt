/**
 * Main wardrobe screen showing item list, delete/edit actions, and recommendation entry.
 */
package com.fitgpt.app.ui.wardrobe

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeFilters
import com.fitgpt.app.viewmodel.WardrobeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WardrobeScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {

    val uiState by viewModel.wardrobeState.collectAsState()
    var query by remember { mutableStateOf("") }
    var showArchived by remember { mutableStateOf(false) }
    var favoritesOnly by remember { mutableStateOf(false) }
    var selectedCategory by remember { mutableStateOf("All") }
    var colorFilter by remember { mutableStateOf("") }
    var clothingTypeFilter by remember { mutableStateOf("") }
    var seasonFilter by remember { mutableStateOf("") }
    var fitTagFilter by remember { mutableStateOf("") }
    var layerTypeFilter by remember { mutableStateOf("") }
    var styleTagFilter by remember { mutableStateOf("") }
    var occasionTagFilter by remember { mutableStateOf("") }
    var accessoryTypeFilter by remember { mutableStateOf("") }
    var setIdentifierFilter by remember { mutableStateOf("") }
    var onePieceOnly by remember { mutableStateOf(false) }
    var showAdvancedFilters by remember { mutableStateOf(false) }
    var bodyFitAssistEnabled by remember { mutableStateOf(false) }

    var itemToDelete by remember { mutableStateOf<ClothingItem?>(null) }

    LaunchedEffect(
        query,
        showArchived,
        favoritesOnly,
        selectedCategory,
        colorFilter,
        clothingTypeFilter,
        seasonFilter,
        fitTagFilter,
        layerTypeFilter,
        styleTagFilter,
        occasionTagFilter,
        accessoryTypeFilter,
        setIdentifierFilter,
        onePieceOnly
    ) {
        viewModel.applyWardrobeFilters(
            WardrobeFilters(
                includeArchived = showArchived,
                search = query.trim().takeIf { it.isNotBlank() },
                category = selectedCategory.takeUnless { it.equals("All", ignoreCase = true) },
                color = colorFilter.trim().takeIf { it.isNotBlank() },
                clothingType = clothingTypeFilter.trim().takeIf { it.isNotBlank() },
                season = seasonFilter.trim().takeIf { it.isNotBlank() },
                fitTag = fitTagFilter.trim().takeIf { it.isNotBlank() },
                layerType = layerTypeFilter.trim().takeIf { it.isNotBlank() },
                styleTag = styleTagFilter.trim().takeIf { it.isNotBlank() },
                occasionTag = occasionTagFilter.trim().takeIf { it.isNotBlank() },
                accessoryType = accessoryTypeFilter.trim().takeIf { it.isNotBlank() },
                setIdentifier = setIdentifierFilter.trim().takeIf { it.isNotBlank() },
                isOnePiece = if (onePieceOnly) true else null,
                favoritesOnly = favoritesOnly
            )
        )
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.WARDROBE,
        title = "Your Wardrobe",
        floatingActionButton = {
            FloatingActionButton(
                onClick = { navController.navigate(Routes.ADD_ITEM) }
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add item")
            }
        }
    ) { padding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
        ) {

            Spacer(modifier = Modifier.height(12.dp))

            SectionHeader(
                title = "Your Wardrobe",
                subtitle = "Manage your clothing and get smart outfit suggestions"
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = { navController.navigate(Routes.RECOMMENDATION) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Get Outfit Recommendation")
            }

            Spacer(modifier = Modifier.height(20.dp))

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Search items") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = showAdvancedFilters,
                    onClick = { showAdvancedFilters = !showAdvancedFilters },
                    label = { Text(if (showAdvancedFilters) "Hide filters" else "Filters") }
                )
                FilterChip(
                    selected = bodyFitAssistEnabled,
                    onClick = { bodyFitAssistEnabled = !bodyFitAssistEnabled },
                    label = { Text(if (bodyFitAssistEnabled) "Body-fit on" else "Body-fit off") }
                )
                FilterChip(
                    selected = !showArchived,
                    onClick = { showArchived = false },
                    label = { Text("Active") }
                )
                FilterChip(
                    selected = showArchived,
                    onClick = { showArchived = true },
                    label = { Text("Archived") }
                )
                FilterChip(
                    selected = onePieceOnly,
                    onClick = { onePieceOnly = !onePieceOnly },
                    label = { Text(if (onePieceOnly) "One-piece only" else "All structures") }
                )
            }

            AnimatedVisibility(visible = showAdvancedFilters) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = colorFilter,
                        onValueChange = { colorFilter = it },
                        label = { Text("Color filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = clothingTypeFilter,
                        onValueChange = { clothingTypeFilter = it },
                        label = { Text("Type filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = seasonFilter,
                        onValueChange = { seasonFilter = it },
                        label = { Text("Season filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = fitTagFilter,
                        onValueChange = { fitTagFilter = it },
                        label = { Text("Fit tag filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = layerTypeFilter,
                        onValueChange = { layerTypeFilter = it },
                        label = { Text("Layer filter (base/mid/outer)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = styleTagFilter,
                        onValueChange = { styleTagFilter = it },
                        label = { Text("Style tag filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = occasionTagFilter,
                        onValueChange = { occasionTagFilter = it },
                        label = { Text("Occasion tag filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = accessoryTypeFilter,
                        onValueChange = { accessoryTypeFilter = it },
                        label = { Text("Accessory type filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = setIdentifierFilter,
                        onValueChange = { setIdentifierFilter = it },
                        label = { Text("Set identifier filter") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !favoritesOnly,
                    onClick = { favoritesOnly = false },
                    label = { Text("All items") }
                )
                FilterChip(
                    selected = favoritesOnly,
                    onClick = { favoritesOnly = true },
                    label = { Text("Favorites") }
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            val categoryFilters = listOf("All", "Top", "Bottom", "Shoes", "Outerwear", "Accessories")
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categoryFilters) { category ->
                    FilterChip(
                        selected = selectedCategory.equals(category, ignoreCase = true),
                        onClick = { selectedCategory = category },
                        label = { Text(category) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            when (uiState) {

                is UiState.Loading -> {
                    CircularProgressIndicator()
                }

                is UiState.Error -> {
                    Text(
                        text = (uiState as UiState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                is UiState.Success -> {
                    val items = (uiState as UiState.Success<List<ClothingItem>>).data
                    val displayItems = if (showArchived) {
                        items.filter { it.isArchived }
                    } else {
                        items.filter { !it.isArchived }
                    }

                    if (displayItems.isEmpty()) {
                        EmptyStateCard(
                            title = "No items found",
                            subtitle = "Try changing filters or add a new item."
                        )
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(displayItems) { item ->
                                WardrobeItemCard(
                                    item = item,
                                    viewModel = viewModel,
                                    showBodyFitAssist = bodyFitAssistEnabled,
                                    onEdit = {
                                        navController.navigate("${Routes.EDIT_ITEM}/${item.id}")
                                    },
                                    onDelete = {
                                        itemToDelete = item
                                    },
                                    onToggleFavorite = {
                                        viewModel.toggleFavorite(item.id)
                                    },
                                    isFavorite = viewModel.isFavorite(item.id)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (itemToDelete != null) {
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            title = { Text("Delete item") },
            text = { Text("Are you sure you want to remove this item?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteItem(itemToDelete!!)
                        itemToDelete = null
                    }
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun WardrobeItemCard(
    item: ClothingItem,
    viewModel: WardrobeViewModel,
    showBodyFitAssist: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleFavorite: () -> Unit,
    isFavorite: Boolean
) {

    val explanation = viewModel.generateExplanation(item)

    WebCard(
        modifier = Modifier.fillMaxWidth(),
        accentTop = false
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RemoteImagePreview(
                imageUrl = item.imageUrl,
                contentDescription = item.category,
                modifier = Modifier.size(72.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {

                Text(
                    text = "${item.name ?: item.category} • ${item.color}",
                    style = MaterialTheme.typography.titleMedium
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${item.season} • ${item.clothingType ?: "Type n/a"} • Fit ${item.fitTag ?: "n/a"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = explanation,
                    style = MaterialTheme.typography.bodySmall
                )

                if (showBodyFitAssist) {
                    Spacer(modifier = Modifier.height(8.dp))
                    WebBadge(text = fitAssistLabel(item.fitTag))
                }
                if (item.isOnePiece) {
                    Spacer(modifier = Modifier.height(6.dp))
                    WebBadge(text = "One-piece")
                }
                item.setIdentifier?.takeIf { it.isNotBlank() }?.let { setId ->
                    Spacer(modifier = Modifier.height(6.dp))
                    WebBadge(text = "Set: $setId")
                }
            }

            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }

            IconButton(onClick = onToggleFavorite) {
                Icon(
                    imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = "Favorite"
                )
            }

            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete")
            }
        }
    }
}

private fun fitAssistLabel(fitTag: String?): String {
    val normalized = fitTag?.trim()?.lowercase().orEmpty()
    return when {
        normalized.contains("slim") || normalized.contains("tailored") -> "Body-fit: structured"
        normalized.contains("regular") -> "Body-fit: balanced"
        normalized.contains("oversized") || normalized.contains("relaxed") -> "Body-fit: relaxed"
        normalized.isBlank() -> "Body-fit: add fit tag for better matching"
        else -> "Body-fit: $normalized"
    }
}
