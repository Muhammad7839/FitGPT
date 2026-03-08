package com.fitgpt.app.data.model

/**
 * Wardrobe item model used across repository, state, and Compose screens.
 */
data class ClothingItem(
    val id: Int,
    val name: String? = null,
    val category: String,
    val clothingType: String? = null,
    val fitTag: String? = null,
    val color: String,
    val season: String,
    val comfortLevel: Int,

    // Optional image
    val imageUrl: String? = null,

    // New fields
    val brand: String? = null,                 // Future barcode + brand preference
    val isAvailable: Boolean = true,           // Laundry / unavailable flag
    val isFavorite: Boolean = false,           // Favorite marker synced with backend
    val isArchived: Boolean = false,           // Soft delete instead of hard delete
    val lastWornTimestamp: Long? = null,       // Rotation tracking
    val createdAt: Long = System.currentTimeMillis()
)
