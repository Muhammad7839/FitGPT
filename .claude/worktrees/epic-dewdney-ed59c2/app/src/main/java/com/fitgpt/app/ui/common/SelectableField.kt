/**
 * Reusable select-first field with optional custom value entry when "Other" is selected.
 */
package com.fitgpt.app.ui.common

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectableField(
    label: String,
    selectedValue: String,
    onValueChange: (String) -> Unit,
    options: List<String>,
    otherOptionLabel: String = FormOptionCatalog.OTHER_OPTION,
    customValue: String = "",
    onCustomValueChange: (String) -> Unit = {},
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    var expanded by remember { mutableStateOf(false) }
    val normalizedSelected = selectedValue.trim()
    val usesCustomValue = normalizedSelected.equals(otherOptionLabel, ignoreCase = true)
    val displayValue = when {
        usesCustomValue && customValue.isNotBlank() -> customValue
        normalizedSelected.isNotBlank() -> normalizedSelected
        else -> ""
    }

    Column(modifier = modifier.fillMaxWidth()) {
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { if (enabled) expanded = !expanded }
        ) {
            OutlinedTextField(
                value = displayValue,
                onValueChange = {},
                label = { Text(label) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(
                        type = MenuAnchorType.PrimaryNotEditable,
                        enabled = enabled
                    ),
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                readOnly = true,
                enabled = enabled
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            expanded = false
                            onValueChange(option)
                            if (!option.equals(otherOptionLabel, ignoreCase = true)) {
                                onCustomValueChange("")
                            }
                        }
                    )
                }
            }
        }

        if (usesCustomValue) {
            OutlinedTextField(
                value = customValue,
                onValueChange = onCustomValueChange,
                label = { Text("$label (custom)") },
                modifier = Modifier.fillMaxWidth(),
                enabled = enabled
            )
        }
    }
}
