/**
 * Lightweight guided tutorial overlay shown on first authenticated dashboard entry.
 */
package com.fitgpt.app.ui.common

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class TutorialStep(
    val title: String,
    val message: String
)

private val defaultTutorialSteps = listOf(
    TutorialStep(
        title = "Welcome to FitGPT",
        message = "Use Home for weather and quick actions, Wardrobe for your items, and Recommend for AI outfit controls."
    ),
    TutorialStep(
        title = "Add items quickly",
        message = "Tap Add Item and use one Add Photo flow for camera or gallery. Multi-select photos are supported."
    ),
    TutorialStep(
        title = "Get recommendations",
        message = "Recommendations include source labels, fallback safety, and context controls for weather, time, and occasion."
    ),
    TutorialStep(
        title = "Save and plan looks",
        message = "You can save outfits, track history, and schedule plans from the secondary tools in More."
    )
)

@Composable
fun GuidedTutorialOverlay(
    visible: Boolean,
    onDismiss: () -> Unit,
    steps: List<TutorialStep> = defaultTutorialSteps
) {
    if (!visible || steps.isEmpty()) return

    var index by remember { mutableIntStateOf(0) }
    val step = steps[index]
    val isLast = index == steps.lastIndex

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text(step.title)
                Text(
                    text = "Step ${index + 1} of ${steps.size}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Text(
                text = step.message,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (isLast) {
                        onDismiss()
                    } else {
                        index += 1
                    }
                }
            ) {
                Text(if (isLast) "Finish" else "Next")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Skip")
            }
        }
    )
}
