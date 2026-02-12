@file:OptIn(ExperimentalMaterial3Api::class)

package com.fitgpt.app.ui.preferences

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.fitgpt.app.data.model.PreferenceOptions
import com.fitgpt.app.data.model.UserPreferences

@Composable
fun UserPreferencesDialog(
    currentPreferences: UserPreferences,
    onDismiss: () -> Unit,
    onSave: (UserPreferences) -> Unit
) {
    var bodyType by remember { mutableStateOf(currentPreferences.bodyType) }
    var bodyTypeExpanded by remember { mutableStateOf(false) }

    var stylePreference by remember { mutableStateOf(currentPreferences.stylePreference) }
    var styleExpanded by remember { mutableStateOf(false) }

    var comfortPreference by remember { mutableStateOf(currentPreferences.comfortPreference.toFloat()) }

    var selectedSeasons by remember {
        mutableStateOf(currentPreferences.preferredSeasons.toSet())
    }

    var accessibilityMode by remember { mutableStateOf(currentPreferences.accessibilityModeEnabled) }

    val bodyTypes = PreferenceOptions.bodyTypes
    val styles = PreferenceOptions.styles
    val allSeasons = PreferenceOptions.allSeasons

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Your Preferences") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Body type dropdown
                ExposedDropdownMenuBox(
                    expanded = bodyTypeExpanded,
                    onExpandedChange = { bodyTypeExpanded = !bodyTypeExpanded }
                ) {
                    OutlinedTextField(
                        value = bodyType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Body Type") },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = bodyTypeExpanded,
                        onDismissRequest = { bodyTypeExpanded = false }
                    ) {
                        bodyTypes.forEach {
                            DropdownMenuItem(
                                text = { Text(it) },
                                onClick = {
                                    bodyType = it
                                    bodyTypeExpanded = false
                                }
                            )
                        }
                    }
                }

                // Style preference dropdown
                ExposedDropdownMenuBox(
                    expanded = styleExpanded,
                    onExpandedChange = { styleExpanded = !styleExpanded }
                ) {
                    OutlinedTextField(
                        value = stylePreference,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Style Preference") },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = styleExpanded,
                        onDismissRequest = { styleExpanded = false }
                    ) {
                        styles.forEach {
                            DropdownMenuItem(
                                text = { Text(it) },
                                onClick = {
                                    stylePreference = it
                                    styleExpanded = false
                                }
                            )
                        }
                    }
                }

                // Comfort level slider
                Text("Comfort Preference: ${comfortPreference.toInt()}")
                Slider(
                    value = comfortPreference,
                    onValueChange = { comfortPreference = it },
                    valueRange = 1f..5f,
                    steps = 3
                )

                // Season checkboxes
                Text(
                    text = "Preferred Seasons",
                    style = MaterialTheme.typography.labelLarge
                )
                allSeasons.forEach { season ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = season in selectedSeasons,
                            onCheckedChange = { checked ->
                                selectedSeasons = if (checked) {
                                    selectedSeasons + season
                                } else {
                                    selectedSeasons - season
                                }
                            }
                        )
                        Text(text = season)
                    }
                }

                // Accessibility toggle
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Accessibility Mode",
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = accessibilityMode,
                        onCheckedChange = { accessibilityMode = it }
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        UserPreferences(
                            bodyType = bodyType,
                            stylePreference = stylePreference,
                            comfortPreference = comfortPreference.toInt(),
                            preferredSeasons = selectedSeasons.toList(),
                            accessibilityModeEnabled = accessibilityMode
                        )
                    )
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
