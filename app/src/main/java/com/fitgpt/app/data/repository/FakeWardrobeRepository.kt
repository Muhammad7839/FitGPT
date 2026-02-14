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

    override fun getWardrobeItems(): List<ClothingItem> {
        // Only return active (not archived) items
        return wardrobeItems.filter { !it.isArchived }
    }

    override fun addItem(item: ClothingItem) {
        wardrobeItems.add(item)
    }

    override fun deleteItem(item: ClothingItem) {
        // Soft delete (archive instead of remove)
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = wardrobeItems[index].copy(
                isArchived = true
            )
        }
    }

    override fun updateItem(item: ClothingItem) {
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = item
        }
    }

    override fun saveOutfit(outfit: SavedOutfit) {
        savedOutfits.add(outfit)
    }

    override fun getSavedOutfits(): List<SavedOutfit> {
        return savedOutfits.toList()
    }
}