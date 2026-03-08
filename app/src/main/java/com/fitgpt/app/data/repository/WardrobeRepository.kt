package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.UploadResult
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
        favoritesOnly: Boolean = false
    ): List<ClothingItem>
    suspend fun addItem(item: ClothingItem)
    suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem>
    suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String
    suspend fun uploadImagesBatch(images: List<UploadImagePayload>): List<UploadResult>
    suspend fun deleteItem(item: ClothingItem)
    suspend fun updateItem(item: ClothingItem)
    suspend fun setFavorite(itemId: Int, isFavorite: Boolean): ClothingItem
    suspend fun getFavoriteItems(): List<ClothingItem>
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
    suspend fun getCurrentWeather(city: String? = null, lat: Double? = null, lon: Double? = null): WeatherSnapshot
    suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long)

    suspend fun getOutfitHistory(): List<OutfitHistoryEntry>
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
