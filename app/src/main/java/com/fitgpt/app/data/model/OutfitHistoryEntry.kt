package com.fitgpt.app.data.model

/**
 * Local representation of an outfit wear event for history and analytics views.
 */
data class OutfitHistoryEntry(
    val id: Long,
    val items: List<ClothingItem>,
    val wornAtTimestamp: Long,
    val source: String = "recommended"
)
