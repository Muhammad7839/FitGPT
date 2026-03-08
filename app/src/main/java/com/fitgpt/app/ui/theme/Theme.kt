/**
 * Material 3 theme setup shared across all Compose screens.
 */
package com.fitgpt.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

private val ColorWhite = Color(0xFFFFFFFF)
private val FitGptShapes = Shapes(
    extraSmall = RoundedCornerShape(12.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(22.dp)
)

private val DarkColorScheme = darkColorScheme(
    primary = FitgptDarkAccent,
    onPrimary = FitgptDarkText,
    secondary = FitgptDarkAccentHover,
    onSecondary = FitgptDarkText,
    tertiary = FitgptSuccess,
    background = FitgptDarkBackground,
    onBackground = FitgptDarkText,
    surface = FitgptDarkSurface,
    onSurface = FitgptDarkText,
    surfaceVariant = FitgptDarkSurfaceVariant,
    onSurfaceVariant = FitgptDarkSubText,
    outline = FitgptDarkOutline,
    error = FitgptDanger
)

private val LightColorScheme = lightColorScheme(
    primary = FitgptAccent,
    onPrimary = ColorWhite,
    secondary = FitgptAccentHover,
    onSecondary = ColorWhite,
    tertiary = FitgptSuccess,
    background = FitgptLightBackground,
    onBackground = FitgptLightText,
    surface = FitgptLightSurface,
    onSurface = FitgptLightText,
    surfaceVariant = FitgptLightSurfaceVariant,
    onSurfaceVariant = FitgptLightSubText,
    outline = FitgptLightOutline,
    error = FitgptDanger
)

@Composable
fun FitGPTTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Keep web-aligned brand palette by default.
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = FitGptShapes,
        content = content
    )
}
