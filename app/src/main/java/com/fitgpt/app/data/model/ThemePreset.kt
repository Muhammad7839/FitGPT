/**
 * Visual theme preset families used to align Android styling with web brand variants.
 */
package com.fitgpt.app.data.model

enum class ThemePreset(
    val id: String,
    val label: String
) {
    CLASSIC("classic", "Classic"),
    OCEAN("ocean", "Ocean"),
    SUNSET("sunset", "Sunset"),
    FOREST("forest", "Forest"),
    MIDNIGHT("midnight", "Midnight"),
    SPRING("spring", "Spring"),
    AUTUMN("autumn", "Autumn"),
    CYBERPUNK("cyberpunk", "Cyberpunk"),
    LAVENDER("lavender", "Lavender"),
    CUSTOM("custom", "Custom");

    companion object {
        fun fromStoredValue(value: String?): ThemePreset {
            if (value.isNullOrBlank()) return CLASSIC
            return entries.firstOrNull { it.id.equals(value, ignoreCase = true) }
                ?: entries.firstOrNull { it.name.equals(value, ignoreCase = true) }
                ?: CLASSIC
        }
    }
}
