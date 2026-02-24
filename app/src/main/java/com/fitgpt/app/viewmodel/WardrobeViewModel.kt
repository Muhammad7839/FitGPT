package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class WardrobeViewModel(private val repository: WardrobeRepository) : ViewModel() {

    // Full source of truth (pre-filter)
    private var allItems: List<ClothingItem> = emptyList()

    // Filters
    private val selectedSeason = MutableStateFlow<String?>(null)
    private val minComfortLevel = MutableStateFlow(1)

    // Exposed filtered list
    private val _wardrobeItems = MutableStateFlow<List<ClothingItem>>(emptyList())
    val wardrobeItems: StateFlow<List<ClothingItem>> = _wardrobeItems

    // Loading & error state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    init {
        loadItems()
    }

    /* ---------- CRUD ---------- */

    fun loadItems() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                allItems = repository.getWardrobeItems()
                applyFilters()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to load items"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun addItem(item: ClothingItem) {
        viewModelScope.launch {
            _errorMessage.value = null
            try {
                repository.addItem(item)
                allItems = repository.getWardrobeItems()
                applyFilters()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to add item"
            }
        }
    }

    fun deleteItem(item: ClothingItem) {
        viewModelScope.launch {
            _errorMessage.value = null
            try {
                repository.deleteItem(item)
                allItems = repository.getWardrobeItems()
                applyFilters()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to delete item"
            }
        }
    }

    fun updateItem(item: ClothingItem) {
        viewModelScope.launch {
            _errorMessage.value = null
            try {
                repository.updateItem(item)
                allItems = repository.getWardrobeItems()
                applyFilters()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Failed to update item"
            }
        }
    }

    /* ---------- SAVED OUTFITS ---------- */

    fun saveOutfit(items: List<ClothingItem>) {
        viewModelScope.launch {
            val outfit = SavedOutfit(
                id = System.currentTimeMillis().toInt(),
                items = items
            )
            repository.saveOutfit(outfit)
        }
    }

    fun getSavedOutfits(): List<SavedOutfit> {
        // For local-only outfits, we block briefly (acceptable for in-memory/local data)
        var result: List<SavedOutfit> = emptyList()
        viewModelScope.launch {
            result = repository.getSavedOutfits()
        }
        return result
    }

    /* ---------- FILTERING ---------- */

    fun setSeasonFilter(season: String?) {
        selectedSeason.value = season
        applyFilters()
    }

    fun setComfortFilter(minComfort: Int) {
        minComfortLevel.value = minComfort
        applyFilters()
    }

    fun clearFilters() {
        selectedSeason.value = null
        minComfortLevel.value = 1
        applyFilters()
    }

    /* ---------- AI EXPLANATION (PLACEHOLDER) ---------- */

    fun generateExplanation(item: ClothingItem): String {
        val comfortText =
            if (item.comfortLevel >= 4) "high comfort"
            else "moderate comfort"

        val seasonText = item.season.lowercase()

        return "Recommended because it offers $comfortText and works well for the $seasonText season."
    }

    /* ---------- INTERNAL ---------- */

    private fun applyFilters() {
        _wardrobeItems.value = allItems.filter { item ->
            val seasonMatch =
                selectedSeason.value == null || item.season == selectedSeason.value

            val comfortMatch =
                item.comfortLevel >= minComfortLevel.value

            seasonMatch && comfortMatch
        }
    }
}
