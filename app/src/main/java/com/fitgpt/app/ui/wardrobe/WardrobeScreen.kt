package com.fitgpt.app.ui.wardrobe

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WardrobeScreen(
    navController: NavController,
    viewModel: WardrobeViewModel = viewModel()
) {

    val uiState by viewModel.wardrobeState.collectAsState()

    var itemToDelete by remember { mutableStateOf<ClothingItem?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Your Wardrobe") }
            )
        },
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

            Text(
                text = "Manage your clothing and get smart outfit suggestions",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = { navController.navigate(Routes.RECOMMENDATION) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Get Outfit Recommendation")
            }

            Spacer(modifier = Modifier.height(20.dp))

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

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(items) { item ->
                            WardrobeItemCard(
                                item = item,
                                viewModel = viewModel,
                                onEdit = {
                                    navController.navigate("${Routes.EDIT_ITEM}/${item.id}")
                                },
                                onDelete = {
                                    itemToDelete = item
                                }
                            )
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
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {

    val explanation = viewModel.generateExplanation(item)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {

            Column(modifier = Modifier.weight(1f)) {

                Text(
                    text = "${item.category} • ${item.color}",
                    style = MaterialTheme.typography.titleMedium
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${item.season} • Comfort ${item.comfortLevel}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = explanation,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "Edit")
            }

            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Delete")
            }
        }
    }
}