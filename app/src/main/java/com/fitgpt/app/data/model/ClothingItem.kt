package com.fitgpt.app.data.model

data class ClothingItem(
    val id: Int,
    val category: String,
    val color: String,
    val season: String,
    val comfortLevel: Int,

    // Optional image
    val imageUrl: String? = null,

    // New fields
    val brand: String? = null,                 // Future barcode + brand preference
    val isAvailable: Boolean = true,           // Laundry / unavailable flag
    val isArchived: Boolean = false,           // Soft delete instead of hard delete
    val lastWornTimestamp: Long? = null,       // Rotation tracking
    val createdAt: Long = System.currentTimeMillis()
)