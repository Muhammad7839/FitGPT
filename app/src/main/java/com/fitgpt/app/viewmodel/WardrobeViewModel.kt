/**
 * Coordinates wardrobe CRUD, recommendations, and wear-history actions for UI screens.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class WardrobeViewModel(
    private val repository: WardrobeRepository
) : ViewModel() {

    private val allItems = mutableListOf<ClothingItem>()

    private val _wardrobeState =
        MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)

    val wardrobeState: StateFlow<UiState<List<ClothingItem>>> =
        _wardrobeState

    private val _recommendationState =
        MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)
    val recommendationState: StateFlow<UiState<List<ClothingItem>>> =
        _recommendationState

    init {
        loadItems()
    }

    private fun loadItems() {
        viewModelScope.launch {
            try {
                allItems.clear()
                allItems.addAll(repository.getWardrobeItems())
                _wardrobeState.value = UiState.Success(allItems.toList())
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to load wardrobe items")
            }
        }
    }

    fun addItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.addItem(item)
                loadItems()
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to add item")
            }
        }
    }

    fun deleteItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.deleteItem(item)
                loadItems()
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to delete item")
            }
        }
    }

    fun updateItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.updateItem(item)
                loadItems()
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to update item")
            }
        }
    }

    fun fetchRecommendations(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
    ) {
        _recommendationState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val recommendations = repository.getRecommendations(
                    manualTemp = manualTemp,
                    timeContext = timeContext,
                    planDate = planDate,
                    exclude = exclude
                )
                _recommendationState.value = UiState.Success(recommendations)
            } catch (e: Exception) {
                _recommendationState.value =
                    UiState.Error("Failed to load recommendations")
            }
        }
    }

    fun markOutfitAsWorn(items: List<ClothingItem>) {
        val timestamp = System.currentTimeMillis()
        viewModelScope.launch {
            try {
                repository.markOutfitAsWorn(items, timestamp)
                loadItems()
                val currentRecs = (_recommendationState.value as? UiState.Success)?.data
                if (currentRecs != null) {
                    fetchRecommendations()
                }
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to update wear history")
            }
        }
    }

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

    fun generateExplanation(item: ClothingItem): String {

        val comfortText =
            if (item.comfortLevel >= 4) "high comfort"
            else "moderate comfort"

        val brandText =
            item.brand?.let { "from $it" } ?: ""

        return "This $brandText piece works well for ${item.season.lowercase()} and provides $comfortText."
    }
}
