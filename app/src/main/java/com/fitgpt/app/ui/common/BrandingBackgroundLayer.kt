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
    val clampedOpacity = logoOpacity.coerceIn(0.04f, 0.08f)
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
                            colors.background.copy(alpha = if (isDarkTheme) 0.18f else 0.32f),
                            colors.background.copy(alpha = if (isDarkTheme) 0.26f else 0.42f),
                            colors.surface.copy(alpha = if (isDarkTheme) 0.28f else 0.48f)
                        )
                    )
                )
        )
        Image(
            painter = painterResource(id = R.drawable.fitgpt_brand_background),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.Center)
                .size(420.dp)
                .blur(34.dp)
                .alpha(clampedOpacity + 0.02f),
            contentScale = ContentScale.Fit
        )
        Image(
            painter = painterResource(id = R.drawable.fitgpt_brand_background),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.Center)
                .size(340.dp)
                .alpha(if (isDarkTheme) clampedOpacity + 0.035f else clampedOpacity + 0.02f),
            contentScale = ContentScale.Fit
        )
    }
}
