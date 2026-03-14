/**
 * Persisted user-defined theme palette used by the custom appearance preset.
 */
package com.fitgpt.app.data.model

import androidx.compose.ui.graphics.Color
import com.google.gson.Gson

data class CustomThemePalette(
    val name: String,
    val accentHex: String,
    val backgroundHex: String,
    val textHex: String,
    val surfaceHex: String,
    val accentHoverHex: String? = null,
    val borderHex: String? = null,
    val mutedHex: String? = null
) {
    fun toJson(): String {
        return Gson().toJson(this)
    }

    companion object {
        fun fromJson(raw: String?): CustomThemePalette? {
            val text = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
            return runCatching {
                val decoded = Gson().fromJson(text, CustomThemePalette::class.java)
                val name = decoded.name.trim().ifEmpty { "Custom Theme" }
                CustomThemePalette(
                    name = name,
                    accentHex = normalizeHex(decoded.accentHex, fallback = "#C43C3C"),
                    backgroundHex = normalizeHex(decoded.backgroundHex, fallback = "#141418"),
                    textHex = normalizeHex(decoded.textHex, fallback = "#E8E6E3"),
                    surfaceHex = normalizeHex(decoded.surfaceHex, fallback = "#1C1C22"),
                    accentHoverHex = decoded.accentHoverHex?.takeIf { it.isNotBlank() }?.let {
                        normalizeHex(it, fallback = "#E04B4B")
                    },
                    borderHex = decoded.borderHex?.takeIf { it.isNotBlank() }?.let {
                        normalizeHex(it, fallback = "#2F2F36")
                    },
                    mutedHex = decoded.mutedHex?.takeIf { it.isNotBlank() }?.let {
                        normalizeHex(it, fallback = "#A7A4A0")
                    }
                )
            }.getOrNull()
        }

        fun normalizeHex(value: String, fallback: String): String {
            val cleaned = value.trim()
            val withPrefix = if (cleaned.startsWith("#")) cleaned else "#$cleaned"
            return if (withPrefix.matches(Regex("^#[0-9a-fA-F]{6}$"))) {
                withPrefix.uppercase()
            } else {
                fallback
            }
        }
    }
}

fun String.toThemeColor(fallback: Color): Color {
    return runCatching {
        Color(android.graphics.Color.parseColor(this))
    }.getOrElse { fallback }
}
