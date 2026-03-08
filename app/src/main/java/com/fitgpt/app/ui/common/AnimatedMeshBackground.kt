package com.fitgpt.app.ui.common

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Lightweight animated mesh-style background that mirrors the web gradient atmosphere.
 */
@Composable
fun AnimatedMeshBackground(
    modifier: Modifier = Modifier,
    backgroundTop: Color,
    backgroundBottom: Color,
    accent: Color,
    accentSoft: Color
) {
    val transition = rememberInfiniteTransition(label = "mesh-bg")
    val t1 by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 12000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "mesh-1"
    )
    val t2 by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 15000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "mesh-2"
    )

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(backgroundTop, backgroundBottom)
                )
            )
    ) {
        val w = size.width
        val h = size.height

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(accentSoft.copy(alpha = 0.28f), Color.Transparent),
                center = Offset(w * (0.12f + 0.22f * t1), h * 0.12f),
                radius = w * 0.85f
            ),
            radius = w * 0.85f,
            center = Offset(w * (0.12f + 0.22f * t1), h * 0.12f)
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(accent.copy(alpha = 0.14f), Color.Transparent),
                center = Offset(w * (0.86f - 0.2f * t2), h * 0.08f),
                radius = w * 0.72f
            ),
            radius = w * 0.72f,
            center = Offset(w * (0.86f - 0.2f * t2), h * 0.08f)
        )
    }
}
