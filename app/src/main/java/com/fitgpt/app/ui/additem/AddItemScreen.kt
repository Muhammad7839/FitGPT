package com.fitgpt.app.ui.additem

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.viewmodel.WardrobeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    var category by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }
    var season by remember { mutableStateOf("") }
    var comfort by remember { mutableStateOf("") }

    Scaffold { padding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
        ) {

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Add New Item",
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.height(24.dp))

            Card(
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {

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
                        label = { Text("Comfort Level (1–5)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    viewModel.addItem(
                        ClothingItem(
                            id = System.currentTimeMillis().toInt(),
                            category = category,
                            color = color,
                            season = season,
                            comfortLevel = comfort.toIntOrNull() ?: 3
                        )
                    )
                    navController.popBackStack()
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Save Item")
            }
        }
    }
}