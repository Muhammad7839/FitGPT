package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.DuplicateCandidate
import com.fitgpt.app.data.model.ForecastRecommendationResult
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.TagSuggestion
import com.fitgpt.app.data.model.UnderusedAlertsResult
import com.fitgpt.app.data.model.TripPackingResult
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WardrobeGapAnalysis
import com.fitgpt.app.data.model.WeatherSnapshot

interface WardrobeRepository {

    suspend fun getWardrobeItems(
        includeArchived: Boolean = false,
        search: String? = null,
        category: String? = null,
        color: String? = null,
        clothingType: String? = null,
        season: String? = null,
        fitTag: String? = null,
        layerType: String? = null,
        isOnePiece: Boolean? = null,
        setIdentifier: String? = null,
        styleTag: String? = null,
        seasonTag: String? = null,
        occasionTag: String? = null,
        accessoryType: String? = null,
        favoritesOnly: Boolean = false
    ): List<ClothingItem>
    suspend fun addItem(item: ClothingItem)
    suspend fun addItemWithPhoto(item: ClothingItem, photo: UploadImagePayload): ClothingItem
    suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem>
    suspend fun suggestTags(item: ClothingItem): TagSuggestion
    suspend fun getItemTagSuggestions(itemId: Int): TagSuggestion
    suspend fun applyItemTagSuggestions(itemId: Int): ClothingItem
    suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String
    suspend fun uploadImagesBatch(images: List<UploadImagePayload>): List<UploadResult>
    suspend fun deleteItem(item: ClothingItem)
    suspend fun updateItem(item: ClothingItem)
    suspend fun setFavorite(itemId: Int, isFavorite: Boolean): ClothingItem
    suspend fun getFavoriteItems(): List<ClothingItem>
    suspend fun getWardrobeGaps(): WardrobeGapAnalysis
    suspend fun getUnderusedAlerts(analysisWindowDays: Int = 21, maxResults: Int = 20): UnderusedAlertsResult
    suspend fun getDuplicateCandidates(threshold: Float = 0.72f, limit: Int = 20): List<DuplicateCandidate>
    suspend fun getRecommendations(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
        weatherCity: String? = null,
        weatherLat: Double? = null,
        weatherLon: Double? = null,
        weatherCategory: String? = null,
        occasion: String? = null,
    ): List<ClothingItem>
    suspend fun getRecommendationOptions(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
        weatherCity: String? = null,
        weatherLat: Double? = null,
        weatherLon: Double? = null,
        weatherCategory: String? = null,
        occasion: String? = null,
        limit: Int = 3,
    ): List<OutfitOption>
    suspend fun getAiRecommendation(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
        weatherCity: String? = null,
        weatherLat: Double? = null,
        weatherLon: Double? = null,
        weatherCategory: String? = null,
        occasion: String? = null,
        stylePreference: String? = null,
        preferredSeasons: List<String> = emptyList()
    ): AiRecommendationResult
    suspend fun rejectRecommendation(itemIds: List<Int>, suggestionId: String? = null)
    suspend fun recordPromptFeedbackEvent(eventType: String, suggestionId: String? = null)

    suspend fun submitRecommendationFeedback(
        suggestionId: String,
        signal: String,
        itemIds: List<Int>? = null
    )
    suspend fun getForecastRecommendation(
        city: String? = null,
        hoursAhead: Int = 24,
        manualTemp: Int? = null,
        weatherCategory: String? = null,
        occasion: String? = null,
        exclude: String? = null,
        stylePreference: String? = null,
        preferredSeasons: List<String> = emptyList()
    ): ForecastRecommendationResult
    suspend fun getCurrentWeather(city: String? = null, lat: Double? = null, lon: Double? = null): WeatherSnapshot
    suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long)

    suspend fun getOutfitHistory(): List<OutfitHistoryEntry>
    suspend fun getOutfitHistoryInRange(startDate: String, endDate: String): List<OutfitHistoryEntry>
    suspend fun updateOutfitHistoryEntry(historyId: Long, itemIds: List<Int>?, wornAtTimestamp: Long?)
    suspend fun deleteOutfitHistoryEntry(historyId: Long)
    suspend fun clearOutfitHistory()

    suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long? = null)
    suspend fun getSavedOutfits(): List<SavedOutfit>
    suspend fun removeSavedOutfit(outfitId: Int)

    suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String)
    suspend fun assignOutfitToDates(
        itemIds: List<Int>,
        plannedDates: List<String>,
        occasion: String?,
        replaceExisting: Boolean
    )
    suspend fun generateTripPackingList(
        destinationCity: String,
        startDate: String,
        tripDays: Int
    ): TripPackingResult
    suspend fun getPlannedOutfits(): List<PlannedOutfit>
    suspend fun removePlannedOutfit(outfitId: Long)
}

/**
 * Upload payload for single image file in batch operations.
 */
data class UploadImagePayload(
    val bytes: ByteArray,
    val fileName: String,
    val mimeType: String
)
