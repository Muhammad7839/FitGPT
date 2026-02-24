package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit

interface WardrobeRepository {

    suspend fun getWardrobeItems(): List<ClothingItem>
    suspend fun addItem(item: ClothingItem)
    suspend fun deleteItem(item: ClothingItem)
    suspend fun updateItem(item: ClothingItem)

    // Saved outfits
    suspend fun saveOutfit(outfit: SavedOutfit)
    suspend fun getSavedOutfits(): List<SavedOutfit>
}
