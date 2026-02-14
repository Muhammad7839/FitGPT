package com.fitgpt.app.ui.edititem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditItemScreen(
    navController: NavController,
    itemId: Int,
    viewModel: WardrobeViewModel
) {
    val state by viewModel.wardrobeState.collectAsState()

    when (state) {

        is UiState.Loading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = androidx.compose.ui.Alignment.Center
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
            val items = (state as UiState.Success<List<ClothingItem>>).data
            val item = items.find { it.id == itemId }

            if (item == null) {
                Text("Item not found")
                return
            }

            var category by remember { mutableStateOf(item.category) }
            var color by remember { mutableStateOf(item.color) }
            var season by remember { mutableStateOf(item.season) }
            var comfort by remember { mutableStateOf(item.comfortLevel.toString()) }

            Scaffold { padding ->

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {

                    Text(
                        text = "Edit Item",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    OutlinedTextField(
                        value = category,
                        onValueChange = { category = it },
                        label = { Text("Category") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = color,
                        onValueChange = { color = it },
                        label = { Text("Color") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = season,
                        onValueChange = { season = it },
                        label = { Text("Season") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = comfort,
                        onValueChange = { comfort = it },
                        label = { Text("Comfort Level") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            viewModel.updateItem(
                                item.copy(
                                    category = category,
                                    color = color,
                                    season = season,
                                    comfortLevel = comfort.toIntOrNull() ?: 3
                                )
                            )
                            navController.popBackStack()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Changes")
                    }
                }
            }
        }
    }
}