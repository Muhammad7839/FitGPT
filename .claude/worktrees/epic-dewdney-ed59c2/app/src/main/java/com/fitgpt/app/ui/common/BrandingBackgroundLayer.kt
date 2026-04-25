/**
 * Static low-opacity branding layer used on top-level screens for subtle FitGPT identity.
 */
package com.fitgpt.app.ui.common

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.fitgpt.app.R

@Composable
fun BrandingBackgroundLayer(
    modifier: Modifier = Modifier,
    logoOpacity: Float = 0.06f
) {
    val clampedOpacity = logoOpacity.coerceIn(0.05f, 0.11f)
    val colors = MaterialTheme.colorScheme
    val isDarkTheme = isSystemInDarkTheme()
    Box(
        modifier = modifier.fillMaxSize()
    ) {
        AnimatedMeshBackground(
            backgroundTop = colors.background,
            backgroundBottom = colors.surfaceVariant.copy(alpha = 0.56f),
            accent = colors.primary,
            accentSoft = colors.tertiary.copy(alpha = 0.8f),
            accentDeep = colors.secondary
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            colors.background.copy(alpha = if (isDarkTheme) 0.14f else 0.16f),
                            colors.background.copy(alpha = if (isDarkTheme) 0.2f else 0.24f),
                            colors.surface.copy(alpha = if (isDarkTheme) 0.22f else 0.3f)
                        )
                    )
                )
        )
        Image(
            painter = painterResource(id = R.drawable.fitgpt_brand_background),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.Center)
                .size(if (isDarkTheme) 430.dp else 470.dp)
                .blur(if (isDarkTheme) 28.dp else 20.dp)
                .alpha(if (isDarkTheme) clampedOpacity + 0.01f else clampedOpacity + 0.03f),
            contentScale = ContentScale.Fit
        )
        Image(
            painter = painterResource(id = R.drawable.fitgpt_brand_background),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.Center)
                .size(if (isDarkTheme) 340.dp else 390.dp)
                .alpha(if (isDarkTheme) clampedOpacity + 0.03f else clampedOpacity + 0.045f),
            contentScale = ContentScale.Fit
        )
    }
}
