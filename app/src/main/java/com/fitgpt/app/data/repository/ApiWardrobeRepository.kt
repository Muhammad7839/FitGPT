package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.remote.FitGptApi
import com.fitgpt.app.data.remote.dto.toClothingItem
import com.fitgpt.app.data.remote.dto.toCreateRequest
import com.fitgpt.app.data.remote.dto.toUpdateRequest

class ApiWardrobeRepository(private val api: FitGptApi) : WardrobeRepository {

    // Saved outfits remain local (no backend route)
    private val savedOutfits = mutableListOf<SavedOutfit>()

    override suspend fun getWardrobeItems(): List<ClothingItem> {
        return api.getWardrobeItems().items.map { it.toClothingItem() }
    }

    override suspend fun addItem(item: ClothingItem) {
        api.addItem(item.toCreateRequest())
    }

    override suspend fun deleteItem(item: ClothingItem) {
        api.deleteItem(item.id)
    }

    override suspend fun updateItem(item: ClothingItem) {
        api.updateItem(item.id, item.toUpdateRequest())
    }

    override suspend fun saveOutfit(outfit: SavedOutfit) {
        savedOutfits.add(outfit)
    }

    override suspend fun getSavedOutfits(): List<SavedOutfit> = savedOutfits
}
