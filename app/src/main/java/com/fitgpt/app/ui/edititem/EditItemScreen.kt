package com.fitgpt.app.ui.edititem

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.viewmodel.WardrobeViewModel

@Composable
fun EditItemScreen(
    navController: NavController,
    itemId: Int,
    viewModel: WardrobeViewModel = viewModel()
) {
    val items by viewModel.wardrobeItems.collectAsState()

    val item = items.find { it.id == itemId }

    if (item == null) {
        Text("Item not found")
        return
    }

    var category by remember { mutableStateOf(item.category) }
    var color by remember { mutableStateOf(item.color) }
    var season by remember { mutableStateOf(item.season) }
    var comfort by remember { mutableStateOf(item.comfortLevel.toString()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {

        Text(
            text = "Edit Item",
            style = MaterialTheme.typography.headlineSmall
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = category,
            onValueChange = { category = it },
            label = { Text("Category") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = color,
            onValueChange = { color = it },
            label = { Text("Color") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = season,
            onValueChange = { season = it },
            label = { Text("Season") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = comfort,
            onValueChange = { comfort = it },
            label = { Text("Comfort Level (1–5)") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                val updatedItem = item.copy(
                    category = category,
                    color = color,
                    season = season,
                    comfortLevel = comfort.toIntOrNull() ?: item.comfortLevel
                )

                viewModel.updateItem(updatedItem)
                navController.popBackStack()
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Save Changes")
        }
    }
}