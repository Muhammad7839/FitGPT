package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.WeatherSnapshot

interface WardrobeRepository {

    suspend fun getWardrobeItems(includeArchived: Boolean = false): List<ClothingItem>
    suspend fun addItem(item: ClothingItem)
    suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String
    suspend fun deleteItem(item: ClothingItem)
    suspend fun updateItem(item: ClothingItem)
    suspend fun getRecommendations(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
        weatherCity: String? = null,
    ): List<ClothingItem>
    suspend fun getCurrentWeather(city: String): WeatherSnapshot
    suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long)

    suspend fun getOutfitHistory(): List<OutfitHistoryEntry>
    suspend fun clearOutfitHistory()

    suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long? = null)
    suspend fun getSavedOutfits(): List<SavedOutfit>
    suspend fun removeSavedOutfit(outfitId: Int)

    suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String)
    suspend fun getPlannedOutfits(): List<PlannedOutfit>
    suspend fun removePlannedOutfit(outfitId: Long)
}
