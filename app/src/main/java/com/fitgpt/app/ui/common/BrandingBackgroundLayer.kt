/**
 * Static low-opacity branding layer used on top-level screens for subtle FitGPT identity.
 */
package com.fitgpt.app.ui.common

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
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        colors.background,
                        colors.surfaceVariant.copy(alpha = 0.55f)
                    )
                )
            )
    ) {
        Image(
            painter = painterResource(id = R.drawable.official_logo),
            contentDescription = null,
            modifier = Modifier
                .align(Alignment.Center)
                .size(320.dp)
                .blur(22.dp)
                .alpha(clampedOpacity)
        )
    }
}

