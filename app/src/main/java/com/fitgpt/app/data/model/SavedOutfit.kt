/**
 * Represents a user-saved outfit assembled from wardrobe items.
 */
package com.fitgpt.app.data.model

data class SavedOutfit(
    val id: Int,
    val items: List<ClothingItem>,
    val note: String = ""
)
