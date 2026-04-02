/**
 * Material 3 theme setup shared across all Compose screens.
 */
package com.fitgpt.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.fitgpt.app.data.model.CustomThemePalette
import com.fitgpt.app.data.model.ThemePreset
import com.fitgpt.app.data.model.toThemeColor

private val ColorWhite = Color(0xFFFFFFFF)
private val ColorBlack = Color(0xFF0F172A)
private val FitGptShapes = Shapes(
    extraSmall = RoundedCornerShape(12.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(22.dp)
)

data class FitGptVisualTokens(
    val meshAccentDeep: Color
)

val LocalFitGptVisualTokens = staticCompositionLocalOf {
    FitGptVisualTokens(meshAccentDeep = FitgptAccentDeep)
}

private data class PresetPalette(
    val lightScheme: ColorScheme,
    val darkScheme: ColorScheme,
    val lightMeshAccentDeep: Color,
    val darkMeshAccentDeep: Color
)

private val ClassicPalette = PresetPalette(
    lightScheme = lightColorScheme(
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
    ),
    darkScheme = darkColorScheme(
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
    ),
    lightMeshAccentDeep = FitgptAccentDeep,
    darkMeshAccentDeep = Color(0xFF2A2E57)
)

private val OceanPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFF0E7490),
        onPrimary = ColorWhite,
        secondary = Color(0xFF0369A1),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF0F766E),
        background = Color(0xFFF0F9FF),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFE2F3FA),
        onSurfaceVariant = Color(0xFF1E3A5F),
        outline = Color(0xFFB4D7E8),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFF38BDF8),
        onPrimary = Color(0xFF032B3B),
        secondary = Color(0xFF0EA5E9),
        onSecondary = Color(0xFF032B3B),
        tertiary = Color(0xFF2DD4BF),
        background = Color(0xFF0B1220),
        onBackground = Color(0xFFE5F3FF),
        surface = Color(0xFF111B2E),
        onSurface = Color(0xFFE5F3FF),
        surfaceVariant = Color(0xFF162843),
        onSurfaceVariant = Color(0xFFB5D5F4),
        outline = Color(0xFF2A456A),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF075985),
    darkMeshAccentDeep = Color(0xFF0A2A45)
)

private val SunsetPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFFD97706),
        onPrimary = ColorWhite,
        secondary = Color(0xFFEA580C),
        onSecondary = ColorWhite,
        tertiary = Color(0xFFBE123C),
        background = Color(0xFFFFF7ED),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFFFEDD5),
        onSurfaceVariant = Color(0xFF7C2D12),
        outline = Color(0xFFF2C79A),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFFFB923C),
        onPrimary = Color(0xFF3F1A00),
        secondary = Color(0xFFF97316),
        onSecondary = Color(0xFF3F1A00),
        tertiary = Color(0xFFFB7185),
        background = Color(0xFF1A110E),
        onBackground = Color(0xFFFFEADB),
        surface = Color(0xFF251915),
        onSurface = Color(0xFFFFEADB),
        surfaceVariant = Color(0xFF38221B),
        onSurfaceVariant = Color(0xFFF3C7AF),
        outline = Color(0xFF6B3D2A),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF9A3412),
    darkMeshAccentDeep = Color(0xFF5B210D)
)

private val ForestPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFF2F855A),
        onPrimary = ColorWhite,
        secondary = Color(0xFF166534),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF15803D),
        background = Color(0xFFF0FDF4),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFDCFCE7),
        onSurfaceVariant = Color(0xFF14532D),
        outline = Color(0xFFB6E5C3),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFF34D399),
        onPrimary = Color(0xFF0B2A1A),
        secondary = Color(0xFF22C55E),
        onSecondary = Color(0xFF0B2A1A),
        tertiary = Color(0xFF86EFAC),
        background = Color(0xFF0B1510),
        onBackground = Color(0xFFE8F8EE),
        surface = Color(0xFF112018),
        onSurface = Color(0xFFE8F8EE),
        surfaceVariant = Color(0xFF193025),
        onSurfaceVariant = Color(0xFFA9D8BA),
        outline = Color(0xFF2F4A3C),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF166534),
    darkMeshAccentDeep = Color(0xFF0F3B24)
)

private val MidnightPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFF4338CA),
        onPrimary = ColorWhite,
        secondary = Color(0xFF6366F1),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF2563EB),
        background = Color(0xFFEFF2FF),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFE0E7FF),
        onSurfaceVariant = Color(0xFF312E81),
        outline = Color(0xFFBCC5F1),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFFA5B4FC),
        onPrimary = Color(0xFF1A1D4D),
        secondary = Color(0xFF818CF8),
        onSecondary = Color(0xFF1A1D4D),
        tertiary = Color(0xFF60A5FA),
        background = Color(0xFF0A1020),
        onBackground = Color(0xFFE7EDFF),
        surface = Color(0xFF121A33),
        onSurface = Color(0xFFE7EDFF),
        surfaceVariant = Color(0xFF1B2646),
        onSurfaceVariant = Color(0xFFBCC7E8),
        outline = Color(0xFF2D3B63),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF312E81),
    darkMeshAccentDeep = Color(0xFF12193B)
)

private val SpringPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFF16A34A),
        onPrimary = ColorWhite,
        secondary = Color(0xFFEC4899),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF22C55E),
        background = Color(0xFFF0FDF4),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFFCE7F3),
        onSurfaceVariant = Color(0xFF831843),
        outline = Color(0xFFE8B8D1),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFF4ADE80),
        onPrimary = Color(0xFF0C3118),
        secondary = Color(0xFFF472B6),
        onSecondary = Color(0xFF3F0830),
        tertiary = Color(0xFF86EFAC),
        background = Color(0xFF131716),
        onBackground = Color(0xFFF3FAF5),
        surface = Color(0xFF1A2020),
        onSurface = Color(0xFFF3FAF5),
        surfaceVariant = Color(0xFF2A1F29),
        onSurfaceVariant = Color(0xFFEBC7DC),
        outline = Color(0xFF523848),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFFBE185D),
    darkMeshAccentDeep = Color(0xFF5A173F)
)

private val AutumnPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFFB45309),
        onPrimary = ColorWhite,
        secondary = Color(0xFF7C2D12),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF854D0E),
        background = Color(0xFFFFFBEB),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFFEF3C7),
        onSurfaceVariant = Color(0xFF78350F),
        outline = Color(0xFFE7D199),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFFFBBF24),
        onPrimary = Color(0xFF3A2403),
        secondary = Color(0xFFFB923C),
        onSecondary = Color(0xFF3A1E0A),
        tertiary = Color(0xFFF59E0B),
        background = Color(0xFF1A140B),
        onBackground = Color(0xFFFFF4DC),
        surface = Color(0xFF251C11),
        onSurface = Color(0xFFFFF4DC),
        surfaceVariant = Color(0xFF3A2A17),
        onSurfaceVariant = Color(0xFFEFD4A5),
        outline = Color(0xFF5E4524),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF92400E),
    darkMeshAccentDeep = Color(0xFF5A3411)
)

private val CyberpunkPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFFBE185D),
        onPrimary = ColorWhite,
        secondary = Color(0xFF0284C7),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF7C3AED),
        background = Color(0xFFFDF2F8),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFE0F2FE),
        onSurfaceVariant = Color(0xFF0C4A6E),
        outline = Color(0xFFBACFE8),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFFF472B6),
        onPrimary = Color(0xFF430D2A),
        secondary = Color(0xFF22D3EE),
        onSecondary = Color(0xFF07384A),
        tertiary = Color(0xFFC084FC),
        background = Color(0xFF0C1020),
        onBackground = Color(0xFFF2EDFF),
        surface = Color(0xFF151A2B),
        onSurface = Color(0xFFF2EDFF),
        surfaceVariant = Color(0xFF1E2741),
        onSurfaceVariant = Color(0xFFBDD7F5),
        outline = Color(0xFF3A4768),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF9D174D),
    darkMeshAccentDeep = Color(0xFF2C1B54)
)

private val LavenderPalette = PresetPalette(
    lightScheme = lightColorScheme(
        primary = Color(0xFF7C3AED),
        onPrimary = ColorWhite,
        secondary = Color(0xFFA855F7),
        onSecondary = ColorWhite,
        tertiary = Color(0xFF6366F1),
        background = Color(0xFFF5F3FF),
        onBackground = ColorBlack,
        surface = Color(0xFFFFFFFF),
        onSurface = ColorBlack,
        surfaceVariant = Color(0xFFEDE9FE),
        onSurfaceVariant = Color(0xFF4C1D95),
        outline = Color(0xFFD2C3F2),
        error = FitgptDanger
    ),
    darkScheme = darkColorScheme(
        primary = Color(0xFFC4B5FD),
        onPrimary = Color(0xFF31175E),
        secondary = Color(0xFFD8B4FE),
        onSecondary = Color(0xFF31175E),
        tertiary = Color(0xFFA5B4FC),
        background = Color(0xFF111026),
        onBackground = Color(0xFFF0EBFF),
        surface = Color(0xFF1A1733),
        onSurface = Color(0xFFF0EBFF),
        surfaceVariant = Color(0xFF262147),
        onSurfaceVariant = Color(0xFFD7CDF8),
        outline = Color(0xFF463E6F),
        error = FitgptDanger
    ),
    lightMeshAccentDeep = Color(0xFF6D28D9),
    darkMeshAccentDeep = Color(0xFF352060)
)

private fun paletteForPreset(
    preset: ThemePreset,
    customTheme: CustomThemePalette?
): PresetPalette {
    return when (preset) {
        ThemePreset.CLASSIC -> ClassicPalette
        ThemePreset.OCEAN -> OceanPalette
        ThemePreset.SUNSET -> SunsetPalette
        ThemePreset.FOREST -> ForestPalette
        ThemePreset.MIDNIGHT -> MidnightPalette
        ThemePreset.SPRING -> SpringPalette
        ThemePreset.AUTUMN -> AutumnPalette
        ThemePreset.CYBERPUNK -> CyberpunkPalette
        ThemePreset.LAVENDER -> LavenderPalette
        ThemePreset.CUSTOM -> customTheme?.toPresetPalette() ?: ClassicPalette
    }
}

private fun blend(from: Color, to: Color, ratio: Float): Color {
    val clamped = ratio.coerceIn(0f, 1f)
    return Color(
        red = from.red + (to.red - from.red) * clamped,
        green = from.green + (to.green - from.green) * clamped,
        blue = from.blue + (to.blue - from.blue) * clamped,
        alpha = from.alpha + (to.alpha - from.alpha) * clamped
    )
}

private fun CustomThemePalette.toPresetPalette(): PresetPalette {
    val accent = accentHex.toThemeColor(FitgptDarkAccent)
    val background = backgroundHex.toThemeColor(FitgptDarkBackground)
    val text = textHex.toThemeColor(FitgptDarkText)
    val surface = surfaceHex.toThemeColor(FitgptDarkSurface)
    val accentHover = (accentHoverHex ?: accentHex).toThemeColor(FitgptDarkAccentHover)
    val border = (borderHex ?: "#2F2F36").toThemeColor(FitgptDarkOutline)
    val muted = (mutedHex ?: "#A7A4A0").toThemeColor(FitgptDarkSubText)
    val lightBackground = blend(background, ColorWhite, 0.86f)
    val lightSurface = blend(surface, ColorWhite, 0.8f)
    val lightAccent = blend(accent, ColorBlack, 0.18f)
    val lightAccentHover = blend(accentHover, ColorBlack, 0.18f)
    val lightOutline = blend(border, ColorBlack, 0.25f)
    val lightMuted = blend(muted, ColorBlack, 0.35f)

    return PresetPalette(
        lightScheme = lightColorScheme(
            primary = lightAccent,
            onPrimary = ColorWhite,
            secondary = lightAccentHover,
            onSecondary = ColorWhite,
            tertiary = blend(lightAccent, lightBackground, 0.35f),
            background = lightBackground,
            onBackground = ColorBlack,
            surface = lightSurface,
            onSurface = ColorBlack,
            surfaceVariant = blend(lightSurface, lightBackground, 0.35f),
            onSurfaceVariant = blend(lightMuted, ColorBlack, 0.2f),
            outline = lightOutline,
            error = FitgptDanger
        ),
        darkScheme = darkColorScheme(
            primary = accent,
            onPrimary = text,
            secondary = accentHover,
            onSecondary = text,
            tertiary = blend(accent, surface, 0.32f),
            background = background,
            onBackground = text,
            surface = surface,
            onSurface = text,
            surfaceVariant = blend(surface, background, 0.28f),
            onSurfaceVariant = muted,
            outline = border,
            error = FitgptDanger
        ),
        lightMeshAccentDeep = blend(lightAccent, ColorBlack, 0.25f),
        darkMeshAccentDeep = blend(accent, background, 0.55f)
    )
}

@Composable
fun FitGPTTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    preset: ThemePreset = ThemePreset.CLASSIC,
    customTheme: CustomThemePalette? = null,
    // Keep web-aligned brand palette by default.
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val palette = paletteForPreset(preset = preset, customTheme = customTheme)
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> palette.darkScheme
        else -> palette.lightScheme
    }
    val visualTokens = FitGptVisualTokens(
        meshAccentDeep = if (darkTheme) palette.darkMeshAccentDeep else palette.lightMeshAccentDeep
    )

    CompositionLocalProvider(LocalFitGptVisualTokens provides visualTokens) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            shapes = FitGptShapes,
            content = content
        )
    }
}
