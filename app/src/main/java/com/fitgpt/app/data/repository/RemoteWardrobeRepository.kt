/**
 * Retrofit-backed wardrobe repository used by the production app flow.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.WeatherSnapshot
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.toCreateRequest
import com.fitgpt.app.data.remote.toDomain
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.PlannedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitCreateRequest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class RemoteWardrobeRepository(
    private val api: ApiService
) : WardrobeRepository {
    private var cachedItemsById = emptyMap<Int, ClothingItem>()

    override suspend fun getWardrobeItems(includeArchived: Boolean): List<ClothingItem> {
        val items = api.getWardrobeItems(includeArchived = includeArchived).map { it.toDomain() }
        cachedItemsById = items.associateBy { it.id }
        return items
    }

    override suspend fun addItem(item: ClothingItem) {
        api.addWardrobeItem(item.toCreateRequest())
    }

    override suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String {
        val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData(
            name = "image",
            filename = fileName,
            body = body
        )
        return api.uploadWardrobeImage(part).imageUrl
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
        exclude: String?,
        weatherCity: String?
    ): List<ClothingItem> {
        return api.getRecommendations(
            manualTemp = manualTemp,
            timeContext = timeContext,
            planDate = planDate,
            exclude = exclude,
            weatherCity = weatherCity
        ).items.map { it.toDomain() }
    }

    override suspend fun getCurrentWeather(city: String): WeatherSnapshot {
        val response = api.getCurrentWeather(city = city)
        return WeatherSnapshot(
            city = response.city,
            temperatureF = response.temperatureF,
            condition = response.condition,
            description = response.description
        )
    }

    override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
        api.saveOutfitHistory(
            OutfitHistoryRequest(
                itemIds = items.map { it.id },
                wornAtTimestamp = wornAtTimestamp
            )
        )
    }

    override suspend fun getOutfitHistory(): List<OutfitHistoryEntry> {
        return api.getOutfitHistory().history.map { entry ->
            OutfitHistoryEntry(
                id = entry.id.toLong(),
                items = mapItemIds(entry.itemIds),
                wornAtTimestamp = entry.wornAtTimestamp
            )
        }
    }

    override suspend fun clearOutfitHistory() {
        api.clearOutfitHistory()
    }

    override suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long?) {
        api.saveOutfit(
            SavedOutfitCreateRequest(
                itemIds = itemIds,
                savedAtTimestamp = savedAtTimestamp
            )
        )
    }

    override suspend fun getSavedOutfits(): List<SavedOutfit> {
        return api.getSavedOutfits().outfits.map { outfit ->
            SavedOutfit(
                id = outfit.id,
                items = mapItemIds(outfit.itemIds)
            )
        }
    }

    override suspend fun removeSavedOutfit(outfitId: Int) {
        api.deleteSavedOutfit(outfitId)
    }

    override suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String) {
        api.savePlannedOutfit(
            PlannedOutfitCreateRequest(
                itemIds = itemIds,
                plannedDate = planDate,
                occasion = occasion.ifBlank { null }
            )
        )
    }

    override suspend fun getPlannedOutfits(): List<PlannedOutfit> {
        return api.getPlannedOutfits().outfits.map { outfit ->
            PlannedOutfit(
                id = outfit.id.toLong(),
                items = mapItemIds(outfit.itemIds),
                planDate = outfit.plannedDate,
                occasion = outfit.occasion.orEmpty(),
                createdAtTimestamp = outfit.createdAtTimestamp
            )
        }
    }

    override suspend fun removePlannedOutfit(outfitId: Long) {
        api.deletePlannedOutfit(outfitId)
    }

    private fun mapItemIds(itemIds: List<Int>): List<ClothingItem> {
        return itemIds.map { itemId ->
            cachedItemsById[itemId] ?: ClothingItem(
                id = itemId,
                category = "Item #$itemId",
                color = "Unknown",
                season = "All",
                comfortLevel = 3
            )
        }
    }
}
