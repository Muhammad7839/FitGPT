package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.repository.FakeWardrobeRepository
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class WardrobeViewModel : ViewModel() {

    private val repository: WardrobeRepository = FakeWardrobeRepository()

    private val allItems = mutableListOf<ClothingItem>()

    private val _wardrobeState =
        MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)

    val wardrobeState: StateFlow<UiState<List<ClothingItem>>> =
        _wardrobeState

    init {
        loadItems()
    }

    /* ---------- LOAD ---------- */

    private fun loadItems() {
        try {
            allItems.clear()
            allItems.addAll(repository.getWardrobeItems())
            _wardrobeState.value = UiState.Success(allItems.toList())
        } catch (e: Exception) {
            _wardrobeState.value =
                UiState.Error("Failed to load wardrobe items")
        }
    }

    /* ---------- CRUD ---------- */

    fun addItem(item: ClothingItem) {
        try {
            repository.addItem(item)
            loadItems()
        } catch (e: Exception) {
            _wardrobeState.value =
                UiState.Error("Failed to add item")
        }
    }

    fun deleteItem(item: ClothingItem) {
        try {
            repository.deleteItem(item)
            loadItems()
        } catch (e: Exception) {
            _wardrobeState.value =
                UiState.Error("Failed to delete item")
        }
    }

    fun updateItem(item: ClothingItem) {
        try {
            repository.updateItem(item)
            loadItems()
        } catch (e: Exception) {
            _wardrobeState.value =
                UiState.Error("Failed to update item")
        }
    }

    /* ---------- Recommendation ---------- */

    fun generateOutfit(): List<ClothingItem> {

        val current =
            (_wardrobeState.value as? UiState.Success)?.data
                ?: return emptyList()

        val available = current
            .filter { it.isAvailable && !it.isArchived }
            .sortedBy { it.lastWornTimestamp ?: 0L }

        val tops = available.filter { it.category.equals("Top", true) }
        val bottoms = available.filter { it.category.equals("Bottom", true) }

        return listOfNotNull(
            tops.firstOrNull(),
            bottoms.firstOrNull()
        )
    }

    fun markOutfitAsWorn(items: List<ClothingItem>) {

        val timestamp = System.currentTimeMillis()

        try {
            items.forEach { item ->
                val updated = item.copy(
                    lastWornTimestamp = timestamp
                )
                repository.updateItem(updated)
            }
            loadItems()
        } catch (e: Exception) {
            _wardrobeState.value =
                UiState.Error("Failed to update wear history")
        }
    }

    /* ---------- Saved Outfits ---------- */

    fun saveOutfit(items: List<ClothingItem>) {
        val outfit = SavedOutfit(
            id = System.currentTimeMillis().toInt(),
            items = items
        )
        repository.saveOutfit(outfit)
    }

    fun getSavedOutfits(): List<SavedOutfit> {
        return repository.getSavedOutfits()
    }

    /* ---------- AI Explanation ---------- */

    fun generateExplanation(item: ClothingItem): String {

        val comfortText =
            if (item.comfortLevel >= 4) "high comfort"
            else "moderate comfort"

        val brandText =
            item.brand?.let { "from $it" } ?: ""

        return "This $brandText piece works well for ${item.season.lowercase()} and provides $comfortText."
    }
}