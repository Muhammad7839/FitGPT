package com.fitgpt.app.ui.common

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Small status badge used across history/saved/plans cards.
 */
@Composable
fun WebBadge(
    text: String,
    background: Color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f),
    content: Color = MaterialTheme.colorScheme.onSurface
) {
    val shape = RoundedCornerShape(999.dp)
    Text(
        text = text,
        modifier = Modifier
            .background(
                color = background,
                shape = shape
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f),
                shape = shape
            )
            .padding(horizontal = 10.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelLarge,
        color = content
    )
}
