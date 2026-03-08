/**
 * Coordinates wardrobe CRUD, recommendations, and wear-history actions for UI screens.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.WeatherSnapshot
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

    private val _historyState = MutableStateFlow<List<OutfitHistoryEntry>>(emptyList())
    val historyState: StateFlow<List<OutfitHistoryEntry>> = _historyState

    private val _plannedState = MutableStateFlow<List<PlannedOutfit>>(emptyList())
    val plannedState: StateFlow<List<PlannedOutfit>> = _plannedState

    private val _savedOutfitsState = MutableStateFlow<List<SavedOutfit>>(emptyList())
    val savedOutfitsState: StateFlow<List<SavedOutfit>> = _savedOutfitsState

    private val _imageUploadState = MutableStateFlow<UiState<String?>>(UiState.Success(null))
    val imageUploadState: StateFlow<UiState<String?>> = _imageUploadState
    private val _weatherState = MutableStateFlow<UiState<WeatherSnapshot?>>(UiState.Success(null))
    val weatherState: StateFlow<UiState<WeatherSnapshot?>> = _weatherState

    init {
        loadItems()
        refreshSavedOutfits()
        refreshHistory()
        refreshPlannedOutfits()
    }

    private fun loadItems() {
        viewModelScope.launch {
            try {
                allItems.clear()
                allItems.addAll(repository.getWardrobeItems(includeArchived = true))
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

    fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String) {
        _imageUploadState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val url = repository.uploadImage(bytes, fileName, mimeType)
                _imageUploadState.value = UiState.Success(url)
            } catch (e: Exception) {
                _imageUploadState.value = UiState.Error("Failed to upload image")
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
        weatherCity: String? = null,
    ) {
        _recommendationState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val recommendations = repository.getRecommendations(
                    manualTemp = manualTemp,
                    timeContext = timeContext,
                    planDate = planDate,
                    exclude = exclude,
                    weatherCity = weatherCity
                )
                _recommendationState.value = UiState.Success(recommendations)
            } catch (e: Exception) {
                _recommendationState.value =
                    UiState.Error("Failed to load recommendations")
            }
        }
    }

    fun fetchWeather(city: String) {
        val cleanedCity = city.trim()
        if (cleanedCity.isEmpty()) {
            _weatherState.value = UiState.Success(null)
            return
        }

        _weatherState.value = UiState.Loading
        viewModelScope.launch {
            try {
                _weatherState.value = UiState.Success(repository.getCurrentWeather(cleanedCity))
            } catch (e: Exception) {
                _weatherState.value = UiState.Error("Failed to load weather")
            }
        }
    }

    fun markOutfitAsWorn(items: List<ClothingItem>) {
        val timestamp = System.currentTimeMillis()
        viewModelScope.launch {
            try {
                repository.markOutfitAsWorn(items, timestamp)
                refreshHistory()
                loadItems()
                fetchRecommendations()
            } catch (e: Exception) {
                _wardrobeState.value =
                    UiState.Error("Failed to update wear history")
            }
        }
    }

    fun saveOutfit(items: List<ClothingItem>) {
        viewModelScope.launch {
            try {
                repository.saveOutfit(
                    itemIds = items.map { it.id },
                    savedAtTimestamp = System.currentTimeMillis()
                )
                refreshSavedOutfits()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to save outfit")
            }
        }
    }

    fun getSavedOutfits(): List<SavedOutfit> {
        return _savedOutfitsState.value
    }

    fun removeSavedOutfit(outfitId: Int) {
        viewModelScope.launch {
            try {
                repository.removeSavedOutfit(outfitId)
                refreshSavedOutfits()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to remove saved outfit")
            }
        }
    }

    fun toggleFavorite(itemId: Int) {
        val item = allItems.firstOrNull { it.id == itemId } ?: return
        viewModelScope.launch {
            try {
                repository.updateItem(item.copy(isFavorite = !item.isFavorite))
                loadItems()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to update favorite")
            }
        }
    }

    fun isFavorite(itemId: Int): Boolean {
        return allItems.firstOrNull { it.id == itemId }?.isFavorite == true
    }

    fun getFavoriteItems(): List<ClothingItem> {
        return allItems.filter { it.isFavorite && !it.isArchived }
    }

    fun planCurrentRecommendation(planDate: String, occasion: String) {
        val recommendation = (recommendationState.value as? UiState.Success)?.data.orEmpty()
        if (recommendation.isEmpty()) return
        viewModelScope.launch {
            try {
                repository.planOutfit(
                    itemIds = recommendation.map { it.id },
                    planDate = planDate,
                    occasion = occasion
                )
                refreshPlannedOutfits()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to plan outfit")
            }
        }
    }

    fun wearPlannedOutfit(planId: Long) {
        val plan = _plannedState.value.firstOrNull { it.id == planId } ?: return
        markOutfitAsWorn(plan.items)
        removePlannedOutfit(planId)
    }

    fun removePlannedOutfit(planId: Long) {
        viewModelScope.launch {
            try {
                repository.removePlannedOutfit(planId)
                refreshPlannedOutfits()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to remove planned outfit")
            }
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            try {
                repository.clearOutfitHistory()
                refreshHistory()
            } catch (e: Exception) {
                _wardrobeState.value = UiState.Error("Failed to clear history")
            }
        }
    }

    fun refreshHistory() {
        viewModelScope.launch {
            try {
                _historyState.value = repository.getOutfitHistory()
            } catch (_: Exception) {
                _historyState.value = emptyList()
            }
        }
    }

    fun refreshSavedOutfits() {
        viewModelScope.launch {
            try {
                _savedOutfitsState.value = repository.getSavedOutfits()
            } catch (_: Exception) {
                _savedOutfitsState.value = emptyList()
            }
        }
    }

    fun refreshPlannedOutfits() {
        viewModelScope.launch {
            try {
                _plannedState.value = repository.getPlannedOutfits()
            } catch (_: Exception) {
                _plannedState.value = emptyList()
            }
        }
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
