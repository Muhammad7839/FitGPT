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
    @SerializedName("is_favorite")
    val isFavorite: Boolean,
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
    @SerializedName("is_favorite")
    val isFavorite: Boolean,
    @SerializedName("is_archived")
    val isArchived: Boolean,
    @SerializedName("last_worn_timestamp")
    val lastWornTimestamp: Long?
)

data class RecommendationResponseDto(
    val items: List<ClothingItemDto>,
    val explanation: String
)

data class WeatherCurrentResponseDto(
    val city: String,
    @SerializedName("temperature_f")
    val temperatureF: Int,
    val condition: String,
    val description: String
)

data class OutfitHistoryRequest(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("worn_at_timestamp")
    val wornAtTimestamp: Long
)

data class OutfitHistoryEntryDto(
    val id: Int,
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("worn_at_timestamp")
    val wornAtTimestamp: Long
)

data class OutfitHistoryListResponseDto(
    val history: List<OutfitHistoryEntryDto>
)

data class SavedOutfitCreateRequest(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("saved_at_timestamp")
    val savedAtTimestamp: Long? = null
)

data class SavedOutfitEntryDto(
    val id: Int,
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("saved_at_timestamp")
    val savedAtTimestamp: Long
)

data class SavedOutfitListResponseDto(
    val outfits: List<SavedOutfitEntryDto>
)

data class PlannedOutfitCreateRequest(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("planned_date")
    val plannedDate: String,
    val occasion: String? = null,
    @SerializedName("created_at_timestamp")
    val createdAtTimestamp: Long? = null
)

data class PlannedOutfitEntryDto(
    val id: Int,
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("planned_date")
    val plannedDate: String,
    val occasion: String?,
    @SerializedName("created_at_timestamp")
    val createdAtTimestamp: Long
)

data class PlannedOutfitListResponseDto(
    val outfits: List<PlannedOutfitEntryDto>
)

data class ImageUploadResponseDto(
    @SerializedName("image_url")
    val imageUrl: String
)
