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
    @SerializedName("suggested_clothing_type")
    val suggestedClothingType: String? = null,
    @SerializedName("suggested_fit_tag")
    val suggestedFitTag: String? = null,
    @SerializedName("suggested_colors")
    val suggestedColors: List<String> = emptyList(),
    @SerializedName("suggested_season_tags")
    val suggestedSeasonTags: List<String> = emptyList(),
    @SerializedName("suggested_style_tags")
    val suggestedStyleTags: List<String> = emptyList(),
    @SerializedName("suggested_occasion_tags")
    val suggestedOccasionTags: List<String> = emptyList(),
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
    @SerializedName("confidence_score")
    val confidenceScore: Float? = null,
    @SerializedName("weather_category")
    val weatherCategory: String?,
    val occasion: String?
)

data class OutfitOptionDto(
    val items: List<ClothingItemDto>,
    val explanation: String,
    @SerializedName("outfit_score")
    val outfitScore: Float,
    @SerializedName("confidence_score")
    val confidenceScore: Float? = null
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

data class TagSuggestionResponseDto(
    val generated: Boolean,
    @SerializedName("suggested_clothing_type")
    val suggestedClothingType: String?,
    @SerializedName("suggested_fit_tag")
    val suggestedFitTag: String?,
    @SerializedName("suggested_colors")
    val suggestedColors: List<String>,
    @SerializedName("suggested_season_tags")
    val suggestedSeasonTags: List<String>,
    @SerializedName("suggested_style_tags")
    val suggestedStyleTags: List<String>,
    @SerializedName("suggested_occasion_tags")
    val suggestedOccasionTags: List<String>
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

data class WardrobeGapSuggestionDto(
    val category: String,
    @SerializedName("item_name")
    val itemName: String,
    val reason: String,
    @SerializedName("image_url")
    val imageUrl: String?,
    @SerializedName("shopping_link")
    val shoppingLink: String
)

data class WardrobeGapResponseDto(
    @SerializedName("baseline_categories")
    val baselineCategories: List<String> = emptyList(),
    @SerializedName("category_counts")
    val categoryCounts: Map<String, Int> = emptyMap(),
    @SerializedName("missing_categories")
    val missingCategories: List<String> = emptyList(),
    val suggestions: List<WardrobeGapSuggestionDto> = emptyList(),
    @SerializedName("insufficient_data")
    val insufficientData: Boolean = false
)


data class UnderusedItemAlertDto(
    @SerializedName("item_id")
    val itemId: Int,
    @SerializedName("item_name")
    val itemName: String,
    val category: String,
    @SerializedName("wear_count")
    val wearCount: Int,
    @SerializedName("last_worn_timestamp")
    val lastWornTimestamp: Long?,
    @SerializedName("days_since_worn")
    val daysSinceWorn: Int?,
    @SerializedName("alert_level")
    val alertLevel: String
)

data class UnderusedAlertsResponseDto(
    @SerializedName("generated_at_timestamp")
    val generatedAtTimestamp: Long,
    @SerializedName("analysis_window_days")
    val analysisWindowDays: Int,
    val alerts: List<UnderusedItemAlertDto>,
    @SerializedName("insufficient_data")
    val insufficientData: Boolean
)
