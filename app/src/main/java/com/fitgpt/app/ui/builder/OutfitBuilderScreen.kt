/**
 * 2D Outfit Builder — lets the user manually assemble an outfit
 * by picking one item per slot (Top, Bottom, Shoes, Outerwear, Accessory)
 * and saving the combination. Live preview strip shows selected items.
 */
package com.fitgpt.app.ui.builder

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

private val BUILDER_SLOTS = listOf("Tops", "Bottoms", "Shoes", "Outerwear", "Accessories")

private val SLOT_EMOJI = mapOf(
    "Tops" to "👕",
    "Bottoms" to "👖",
    "Shoes" to "👟",
    "Outerwear" to "🧥",
    "Accessories" to "👜"
)

@Composable
fun OutfitBuilderScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val wardrobeState by viewModel.wardrobeState.collectAsState()
    val saveOutfitState by viewModel.saveOutfitState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Map from slot name to the selected item
    val selectedItems = remember { mutableStateMapOf<String, ClothingItem>() }
    var pickerSlot by remember { mutableStateOf<String?>(null) }

    val allItems = (wardrobeState as? UiState.Success<List<ClothingItem>>)
        ?.data
        .orEmpty()
        .filter { !it.isArchived }

    // Handle save state feedback
    LaunchedEffect(saveOutfitState) {
        when (val s = saveOutfitState) {
            is UiState.Success -> {
                if (s.data == true) {
                    snackbarHostState.showSnackbar("Outfit saved!")
                    selectedItems.clear()
                    viewModel.clearSaveOutfitState()
                }
            }
            is UiState.Error -> {
                snackbarHostState.showSnackbar(s.message)
                viewModel.clearSaveOutfitState()
            }
            else -> {}
        }
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.OUTFIT_BUILDER,
        title = "Outfit Builder"
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    SectionHeader(
                        title = "Build an Outfit",
                        subtitle = "Pick one item per slot, then save the combination."
                    )
                }

                // Live preview strip — shows selected items as a horizontal scroll
                val previewItems = BUILDER_SLOTS.mapNotNull { selectedItems[it] }
                if (previewItems.isNotEmpty()) {
                    item {
                        WebCard(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "Your Outfit (${previewItems.size} piece${if (previewItems.size == 1) "" else "s"})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(bottom = 10.dp)
                                )
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(previewItems) { item ->
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            if (!item.imageUrl.isNullOrBlank()) {
                                                RemoteImagePreview(
                                                    imageUrl = item.imageUrl,
                                                    contentDescription = item.name ?: item.category,
                                                    modifier = Modifier
                                                        .size(72.dp)
                                                        .clip(RoundedCornerShape(12.dp))
                                                )
                                            } else {
                                                Box(
                                                    modifier = Modifier
                                                        .size(72.dp)
                                                        .clip(RoundedCornerShape(12.dp))
                                                        .background(MaterialTheme.colorScheme.surfaceVariant),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Text(
                                                        text = SLOT_EMOJI[item.category] ?: "👔",
                                                        style = MaterialTheme.typography.headlineSmall
                                                    )
                                                }
                                            }
                                            Text(
                                                text = item.category,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (allItems.isEmpty()) {
                    item {
                        EmptyStateCard(
                            title = "No wardrobe items",
                            subtitle = "Add some clothing in the Wardrobe tab first."
                        )
                    }
                } else {
                    // Slot rows
                    items(BUILDER_SLOTS) { slot ->
                        BuilderSlotRow(
                            slot = slot,
                            selected = selectedItems[slot],
                            onClick = { pickerSlot = slot },
                            onClear = { selectedItems.remove(slot) }
                        )
                    }

                    // Save button
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        val chosenItems = BUILDER_SLOTS.mapNotNull { selectedItems[it] }
                        Button(
                            onClick = { if (chosenItems.size >= 2) viewModel.saveOutfit(chosenItems) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = chosenItems.size >= 2 && saveOutfitState !is UiState.Loading
                        ) {
                            Text(
                                if (saveOutfitState is UiState.Loading)
                                    "Saving…"
                                else
                                    "Save Outfit (${chosenItems.size} item${if (chosenItems.size == 1) "" else "s"})"
                            )
                        }
                        if (chosenItems.size < 2) {
                            Text(
                                "Select at least 2 items to save",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }
            }

            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }

    // Item picker dialog
    pickerSlot?.let { slot ->
        val slotItems = allItems.filter { item ->
            item.category.equals(slot, ignoreCase = true) ||
                item.category.contains(slot.trimEnd('s'), ignoreCase = true)
        }
        ItemPickerDialog(
            slot = slot,
            items = slotItems,
            currentSelection = selectedItems[slot],
            onSelect = { item ->
                selectedItems[slot] = item
                pickerSlot = null
            },
            onDismiss = { pickerSlot = null }
        )
    }
}

@Composable
private fun BuilderSlotRow(
    slot: String,
    selected: ClothingItem?,
    onClick: () -> Unit,
    onClear: () -> Unit
) {
    WebCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = if (selected == null) onClick else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Slot thumbnail or placeholder
            if (selected?.imageUrl != null) {
                RemoteImagePreview(
                    imageUrl = selected.imageUrl,
                    contentDescription = selected.name ?: slot,
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(10.dp))
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f))
                        .border(
                            1.dp,
                            MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                            RoundedCornerShape(10.dp)
                        )
                        .clickable { onClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = SLOT_EMOJI[slot] ?: slot.first().toString(),
                        style = MaterialTheme.typography.titleLarge
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = slot,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (selected != null) {
                    Text(
                        text = selected.name
                            ?: listOfNotNull(selected.color, selected.category)
                                .joinToString(" ")
                                .ifBlank { "Item" },
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = selected.color,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = "Tap to pick a $slot item",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (selected != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onClick) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = "Change",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    IconButton(onClick = onClear) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Remove",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ItemPickerDialog(
    slot: String,
    items: List<ClothingItem>,
    currentSelection: ClothingItem?,
    onSelect: (ClothingItem) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pick a $slot item") },
        text = {
            if (items.isEmpty()) {
                Text("No $slot items in your wardrobe. Add some from the Wardrobe tab.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(items) { item ->
                        val isSelected = item.id == currentSelection?.id
                        val label = item.name
                            ?: listOfNotNull(item.color, item.category).joinToString(" ").ifBlank { "Item" }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (isSelected) MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                )
                                .clickable { onSelect(item) }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            if (item.imageUrl != null) {
                                RemoteImagePreview(
                                    imageUrl = item.imageUrl,
                                    contentDescription = label,
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.surfaceVariant),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label.first().toString(),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(label, style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    item.color,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
