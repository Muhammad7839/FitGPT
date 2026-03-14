/**
 * Transport models for wardrobe, recommendation, and outfit-history APIs.
 */
package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ClothingItemDto(
    val id: Int,
    val name: String?,
    val category: String,
    @SerializedName("clothing_type")
    val clothingType: String?,
    @SerializedName("layer_type")
    val layerType: String? = null,
    @SerializedName("is_one_piece")
    val isOnePiece: Boolean = false,
    @SerializedName("set_identifier")
    val setIdentifier: String? = null,
    @SerializedName("fit_tag")
    val fitTag: String?,
    val color: String,
    val colors: List<String> = emptyList(),
    val season: String,
    @SerializedName("season_tags")
    val seasonTags: List<String> = emptyList(),
    @SerializedName("style_tags")
    val styleTags: List<String> = emptyList(),
    @SerializedName("occasion_tags")
    val occasionTags: List<String> = emptyList(),
    @SerializedName("accessory_type")
    val accessoryType: String? = null,
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
    val name: String?,
    val category: String,
    @SerializedName("clothing_type")
    val clothingType: String?,
    @SerializedName("layer_type")
    val layerType: String? = null,
    @SerializedName("is_one_piece")
    val isOnePiece: Boolean = false,
    @SerializedName("set_identifier")
    val setIdentifier: String? = null,
    @SerializedName("fit_tag")
    val fitTag: String?,
    val color: String,
    val colors: List<String> = emptyList(),
    val season: String,
    @SerializedName("season_tags")
    val seasonTags: List<String> = emptyList(),
    @SerializedName("style_tags")
    val styleTags: List<String> = emptyList(),
    @SerializedName("occasion_tags")
    val occasionTags: List<String> = emptyList(),
    @SerializedName("accessory_type")
    val accessoryType: String? = null,
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
    val explanation: String,
    @SerializedName("outfit_score")
    val outfitScore: Float,
    @SerializedName("weather_category")
    val weatherCategory: String?,
    val occasion: String?
)

data class OutfitOptionDto(
    val items: List<ClothingItemDto>,
    val explanation: String,
    @SerializedName("outfit_score")
    val outfitScore: Float
)

data class RecommendationOptionsResponseDto(
    val outfits: List<OutfitOptionDto>,
    @SerializedName("weather_category")
    val weatherCategory: String,
    val occasion: String?
)

data class WeatherCurrentResponseDto(
    val city: String,
    @SerializedName("temperature_f")
    val temperatureF: Int,
    @SerializedName("weather_category")
    val weatherCategory: String,
    val condition: String,
    val description: String
)

data class FavoriteToggleRequestDto(
    @SerializedName("is_favorite")
    val isFavorite: Boolean
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

data class PlannedOutfitAssignmentRequestDto(
    @SerializedName("item_ids")
    val itemIds: List<Int>,
    @SerializedName("planned_dates")
    val plannedDates: List<String>,
    val occasion: String? = null,
    @SerializedName("replace_existing")
    val replaceExisting: Boolean = true
)

data class PlannedOutfitAssignmentResponseDto(
    val detail: String,
    @SerializedName("planned_dates")
    val plannedDates: List<String>,
    val outfits: List<PlannedOutfitEntryDto>
)

data class ImageUploadResponseDto(
    @SerializedName("image_url")
    val imageUrl: String
)

data class ImageBatchUploadEntryDto(
    @SerializedName("file_name")
    val fileName: String,
    val status: String,
    @SerializedName("image_url")
    val imageUrl: String?,
    val error: String?
)

data class ImageBatchUploadResponseDto(
    val results: List<ImageBatchUploadEntryDto>
)

data class BulkCreateClothingItemsRequestDto(
    val items: List<ClothingItemCreateRequest>
)

data class BulkCreateItemResultDto(
    val index: Int,
    val status: String,
    val item: ClothingItemDto?,
    val error: String?
)

data class BulkCreateClothingItemsResponseDto(
    val results: List<BulkCreateItemResultDto>
)
