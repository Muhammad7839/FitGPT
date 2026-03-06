package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit

interface WardrobeRepository {

    suspend fun getWardrobeItems(): List<ClothingItem>
    suspend fun addItem(item: ClothingItem)
    suspend fun deleteItem(item: ClothingItem)
    suspend fun updateItem(item: ClothingItem)
    suspend fun getRecommendations(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
    ): List<ClothingItem>
    suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long)

    // Saved outfits
    fun saveOutfit(outfit: SavedOutfit)
    fun getSavedOutfits(): List<SavedOutfit>
}
