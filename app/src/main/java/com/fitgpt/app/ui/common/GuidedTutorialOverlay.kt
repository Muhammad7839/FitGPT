/**
 * Lightweight guided tutorial overlay shown on first authenticated dashboard entry.
 * Polished: dot-style progress indicator, cleaner step wording, consistent button hierarchy.
 */
package com.fitgpt.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

data class TutorialStep(
    val title: String,
    val message: String
)

private val defaultTutorialSteps = listOf(
    TutorialStep(
        title = "Welcome to FitGPT",
        message = "Home shows your weather and daily outfit. Wardrobe holds your items. Recommend gives you AI-powered outfit controls."
    ),
    TutorialStep(
        title = "Build your wardrobe",
        message = "Tap the + button to add clothing from your camera or gallery. AI will auto-detect the category and color."
    ),
    TutorialStep(
        title = "Get outfit recommendations",
        message = "FitGPT picks outfits based on weather, time of day, and your style. Refresh any time for new ideas."
    ),
    TutorialStep(
        title = "Save and plan looks",
        message = "Save favorites, log what you wore, and schedule outfits ahead of time from the Plans and More tabs."
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
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = step.title,
                    style = MaterialTheme.typography.titleLarge
                )
                // Dot progress indicator
                Row(
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    steps.forEachIndexed { i, _ ->
                        val isActive = i == index
                        Box(
                            modifier = Modifier
                                .width(if (isActive) 18.dp else 6.dp)
                                .height(6.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isActive)
                                        MaterialTheme.colorScheme.primary
                                    else
                                        MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                                )
                        )
                    }
                }
            }
        },
        text = {
            Text(
                text = step.message,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
            )
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (isLast) onDismiss() else index += 1
                }
            ) {
                Text(
                    text = if (isLast) "Let's go" else "Next",
                    color = MaterialTheme.colorScheme.primary
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(
                    text = "Skip",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    )
}
