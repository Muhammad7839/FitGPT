package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.toCreateRequest
import com.fitgpt.app.data.remote.toDomain
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest

class RemoteWardrobeRepository(
    private val api: ApiService
) : WardrobeRepository {
    private val savedOutfits = mutableListOf<SavedOutfit>()

    override suspend fun getWardrobeItems(): List<ClothingItem> {
        return api.getWardrobeItems().map { it.toDomain() }
    }

    override suspend fun addItem(item: ClothingItem) {
        api.addWardrobeItem(item.toCreateRequest())
    }

    override suspend fun deleteItem(item: ClothingItem) {
        api.deleteWardrobeItem(item.id)
    }

    override suspend fun updateItem(item: ClothingItem) {
        api.updateWardrobeItem(item.id, item.toCreateRequest())
    }

    override suspend fun getRecommendations(
        manualTemp: Int?,
        timeContext: String?,
        planDate: String?,
        exclude: String?
    ): List<ClothingItem> {
        return api.getRecommendations(
            manualTemp = manualTemp,
            timeContext = timeContext,
            planDate = planDate,
            exclude = exclude
        ).items.map { it.toDomain() }
    }

    override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
        api.saveOutfitHistory(
            OutfitHistoryRequest(
                itemIds = items.map { it.id },
                wornAtTimestamp = wornAtTimestamp
            )
        )
    }

    override fun saveOutfit(outfit: SavedOutfit) {
        savedOutfits.add(outfit)
    }

    override fun getSavedOutfits(): List<SavedOutfit> {
        return savedOutfits.toList()
    }
}
