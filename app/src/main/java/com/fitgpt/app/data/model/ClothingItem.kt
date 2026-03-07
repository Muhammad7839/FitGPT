/**
 * Domain model used by UI and repositories to represent a wardrobe item.
 */
package com.fitgpt.app.data.model

data class ClothingItem(
    val id: Int,
    val category: String,
    val color: String,
    val season: String,
    val comfortLevel: Int,

    val imageUrl: String? = null,

    val brand: String? = null,
    val isAvailable: Boolean = true,
    val isArchived: Boolean = false,
    // Used by recommendation ordering so recently worn items rotate out.
    val lastWornTimestamp: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)
