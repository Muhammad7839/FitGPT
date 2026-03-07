/**
 * In-memory wardrobe repository used by local tests and offline development paths.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit

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

    override suspend fun getWardrobeItems(): List<ClothingItem> {
        return wardrobeItems.filter { !it.isArchived }
    }

    override suspend fun addItem(item: ClothingItem) {
        wardrobeItems.add(item)
    }

    override suspend fun deleteItem(item: ClothingItem) {
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
        exclude: String?
    ): List<ClothingItem> {
        val available = wardrobeItems
            .filter { it.isAvailable && !it.isArchived }
            .sortedBy { it.lastWornTimestamp ?: 0L }
        val tops = available.filter { it.category.equals("Top", true) }
        val bottoms = available.filter { it.category.equals("Bottom", true) }
        val shoes = available.filter { it.category.equals("Shoes", true) }
        return listOfNotNull(tops.firstOrNull(), bottoms.firstOrNull(), shoes.firstOrNull())
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
    }

    override fun saveOutfit(outfit: SavedOutfit) {
        savedOutfits.add(outfit)
    }

    override fun getSavedOutfits(): List<SavedOutfit> {
        return savedOutfits.toList()
    }
}
