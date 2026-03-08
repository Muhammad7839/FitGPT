package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.WeatherSnapshot

class FakeWardrobeRepository : WardrobeRepository {

    private val wardrobeItems = mutableListOf(
        ClothingItem(
            id = 1,
            category = "Top",
            color = "Black",
            season = "Winter",
            comfortLevel = 3,
            brand = "Uniqlo"
        ),
        ClothingItem(
            id = 2,
            category = "Bottom",
            color = "Blue",
            season = "All",
            comfortLevel = 4,
            brand = "Levi's"
        )
    )

    private val savedOutfits = mutableListOf<SavedOutfit>()
    private val historyEntries = mutableListOf<OutfitHistoryEntry>()
    private val plannedOutfits = mutableListOf<PlannedOutfit>()

    override suspend fun getWardrobeItems(includeArchived: Boolean): List<ClothingItem> {
        return if (includeArchived) {
            wardrobeItems.toList()
        } else {
            wardrobeItems.filter { !it.isArchived }
        }
    }

    override suspend fun addItem(item: ClothingItem) {
        wardrobeItems.add(item)
    }

    override suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String {
        return "https://example.com/uploads/$fileName"
    }

    override suspend fun deleteItem(item: ClothingItem) {
        // Soft delete (archive instead of remove)
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = wardrobeItems[index].copy(
                isArchived = true
            )
        }
    }

    override suspend fun updateItem(item: ClothingItem) {
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = item
        }
    }

    override suspend fun getRecommendations(
        manualTemp: Int?,
        timeContext: String?,
        planDate: String?,
        exclude: String?,
        weatherCity: String?
    ): List<ClothingItem> {
        val available = wardrobeItems
            .filter { it.isAvailable && !it.isArchived }
            .sortedBy { it.lastWornTimestamp ?: 0L }
        val tops = available.filter { it.category.equals("Top", true) }
        val bottoms = available.filter { it.category.equals("Bottom", true) }
        val shoes = available.filter { it.category.equals("Shoes", true) }
        return listOfNotNull(tops.firstOrNull(), bottoms.firstOrNull(), shoes.firstOrNull())
    }

    override suspend fun getCurrentWeather(city: String): WeatherSnapshot {
        return WeatherSnapshot(
            city = city,
            temperatureF = 72,
            condition = "Clear",
            description = "clear sky"
        )
    }

    override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
        items.forEach { item ->
            val index = wardrobeItems.indexOfFirst { it.id == item.id }
            if (index != -1) {
                wardrobeItems[index] = wardrobeItems[index].copy(
                    lastWornTimestamp = wornAtTimestamp
                )
            }
        }
        historyEntries.add(
            0,
            OutfitHistoryEntry(
                id = wornAtTimestamp,
                items = items,
                wornAtTimestamp = wornAtTimestamp
            )
        )
    }

    override suspend fun getOutfitHistory(): List<OutfitHistoryEntry> {
        return historyEntries.toList()
    }

    override suspend fun clearOutfitHistory() {
        historyEntries.clear()
    }

    override suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long?) {
        val outfitItems = wardrobeItems.filter { itemIds.contains(it.id) }
        savedOutfits.add(
            0,
            SavedOutfit(
                id = (savedAtTimestamp ?: System.currentTimeMillis()).toInt(),
                items = outfitItems
            )
        )
    }

    override suspend fun getSavedOutfits(): List<SavedOutfit> {
        return savedOutfits.toList()
    }

    override suspend fun removeSavedOutfit(outfitId: Int) {
        savedOutfits.removeAll { it.id == outfitId }
    }

    override suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String) {
        val outfitItems = wardrobeItems.filter { itemIds.contains(it.id) }
        plannedOutfits.add(
            0,
            PlannedOutfit(
                id = System.currentTimeMillis(),
                items = outfitItems,
                planDate = planDate,
                occasion = occasion
            )
        )
    }

    override suspend fun getPlannedOutfits(): List<PlannedOutfit> {
        return plannedOutfits.toList()
    }

    override suspend fun removePlannedOutfit(outfitId: Long) {
        plannedOutfits.removeAll { it.id == outfitId }
    }
}
