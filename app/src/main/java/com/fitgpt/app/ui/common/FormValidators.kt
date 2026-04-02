/**
 * Shared UI validation helpers for form-heavy Compose screens.
 */
package com.fitgpt.app.ui.common

import java.time.LocalDate

const val MAX_LOCAL_IMAGE_BYTES: Int = 5 * 1024 * 1024

fun isImagePayloadAllowed(byteCount: Int): Boolean {
    return byteCount in 1..MAX_LOCAL_IMAGE_BYTES
}

fun validateClothingItemForm(
    category: String,
    color: String,
    season: String,
    comfortText: String
): String? {
    if (category.trim().isEmpty()) return "Category is required"
    if (color.trim().isEmpty()) return "Color is required"
    if (season.trim().isEmpty()) return "Season is required"

    val comfort = comfortText.toIntOrNull() ?: return "Comfort level must be a number from 1 to 5"
    if (comfort !in 1..5) return "Comfort level must be between 1 and 5"

    return null
}

fun parseComfortLevel(comfortText: String): Int {
    return comfortText.toIntOrNull()?.coerceIn(1, 5) ?: 3
}

fun isValidPlanDate(planDate: String): Boolean {
    val trimmed = planDate.trim()
    return runCatching { LocalDate.parse(trimmed) }.isSuccess
}
