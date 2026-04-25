package com.fitgpt.app.data.model

/**
 * Planned outfit entry shown in the plans section.
 */
data class PlannedOutfit(
    val id: Long,
    val items: List<ClothingItem>,
    val planDate: String,
    val occasion: String = "",
    val createdAtTimestamp: Long = System.currentTimeMillis()
)
