/**
 * Transport models for wardrobe, recommendation, and outfit-history APIs.
 */
package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ClothingItemDto(
    val id: Int,
    val category: String,
    val color: String,
    val season: String,
    @SerializedName("comfort_level")
    val comfortLevel: Int,
    @SerializedName("image_url")
    val imageUrl: String?,
    val brand: String?,
    @SerializedName("is_available")
    val isAvailable: Boolean,
    @SerializedName("is_archived")
    val isArchived: Boolean,
    @SerializedName("last_worn_timestamp")
    val lastWornTimestamp: Long?
)

data class ClothingItemCreateRequest(
    val category: String,
    val color: String,
    val season: String,
    @SerializedName("comfort_level")
    val comfortLevel: Int,
    @SerializedName("image_url")
    val imageUrl: String?,
    val brand: String?,
    @SerializedName("is_available")
    val isAvailable: Boolean,
    @SerializedName("is_archived")
    val isArchived: Boolean,
    @SerializedName("last_worn_timestamp")
    val lastWornTimestamp: Long?
)

data class RecommendationResponseDto(
    val items: List<ClothingItemDto>,
    val explanation: String
)

data class OutfitHistoryRequest(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("worn_at_timestamp")
    val wornAtTimestamp: Long
)
