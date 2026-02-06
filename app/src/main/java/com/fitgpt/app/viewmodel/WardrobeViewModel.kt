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

    // Full source of truth
    private val allItems = MutableStateFlow(repository.getWardrobeItems())

    // Filters
    private val selectedSeason = MutableStateFlow<String?>(null)
    private val minComfortLevel = MutableStateFlow(1)

    // Exposed filtered list
    private val _wardrobeItems =
        MutableStateFlow<List<ClothingItem>>(allItems.value)
    val wardrobeItems: StateFlow<List<ClothingItem>> = _wardrobeItems

    /* ---------- CRUD ---------- */

    fun addItem(item: ClothingItem) {
        repository.addItem(item)
        refresh()
    }

    fun deleteItem(item: ClothingItem) {
        repository.deleteItem(item)
        refresh()
    }

    fun updateItem(item: ClothingItem) {
        repository.updateItem(item)
        refresh()
    }

    /* ---------- SAVED OUTFITS ---------- */

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

    private fun refresh() {
        allItems.value = repository.getWardrobeItems()
        applyFilters()
    }

    private fun applyFilters() {
        _wardrobeItems.value = allItems.value.filter { item ->
            val seasonMatch =
                selectedSeason.value == null || item.season == selectedSeason.value

            val comfortMatch =
                item.comfortLevel >= minComfortLevel.value

            seasonMatch && comfortMatch
        }
    }
}