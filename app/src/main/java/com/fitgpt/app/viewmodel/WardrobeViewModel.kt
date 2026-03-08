/**
 * Coordinates wardrobe CRUD, recommendations, and outfit workflow actions for UI screens.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WeatherSnapshot
import com.fitgpt.app.data.repository.UploadImagePayload
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class WardrobeFilters(
    val includeArchived: Boolean = true,
    val search: String? = null,
    val category: String? = null,
    val color: String? = null,
    val clothingType: String? = null,
    val season: String? = null,
    val fitTag: String? = null,
    val favoritesOnly: Boolean = false
)

class WardrobeViewModel(
    private val repository: WardrobeRepository
) : ViewModel() {

    private val allItems = mutableListOf<ClothingItem>()
    private var currentFilters = WardrobeFilters()

    private val _wardrobeState = MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)
    val wardrobeState: StateFlow<UiState<List<ClothingItem>>> = _wardrobeState

    private val _recommendationState = MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)
    val recommendationState: StateFlow<UiState<List<ClothingItem>>> = _recommendationState

    private val _historyState = MutableStateFlow<List<OutfitHistoryEntry>>(emptyList())
    val historyState: StateFlow<List<OutfitHistoryEntry>> = _historyState

    private val _plannedState = MutableStateFlow<List<PlannedOutfit>>(emptyList())
    val plannedState: StateFlow<List<PlannedOutfit>> = _plannedState

    private val _savedOutfitsState = MutableStateFlow<List<SavedOutfit>>(emptyList())
    val savedOutfitsState: StateFlow<List<SavedOutfit>> = _savedOutfitsState

    private val _imageUploadState = MutableStateFlow<UiState<String?>>(UiState.Success(null))
    val imageUploadState: StateFlow<UiState<String?>> = _imageUploadState

    private val _batchImageUploadState =
        MutableStateFlow<UiState<List<UploadResult>>>(UiState.Success(emptyList()))
    val batchImageUploadState: StateFlow<UiState<List<UploadResult>>> = _batchImageUploadState

    private val _weatherState = MutableStateFlow<UiState<WeatherSnapshot?>>(UiState.Success(null))
    val weatherState: StateFlow<UiState<WeatherSnapshot?>> = _weatherState

    init {
        refreshWardrobe()
        refreshSavedOutfits()
        refreshHistory()
        refreshPlannedOutfits()
    }

    fun applyWardrobeFilters(filters: WardrobeFilters) {
        currentFilters = filters
        refreshWardrobe()
    }

    fun refreshWardrobe() {
        _wardrobeState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val items = repository.getWardrobeItems(
                    includeArchived = currentFilters.includeArchived,
                    search = currentFilters.search,
                    category = currentFilters.category,
                    color = currentFilters.color,
                    clothingType = currentFilters.clothingType,
                    season = currentFilters.season,
                    fitTag = currentFilters.fitTag,
                    favoritesOnly = currentFilters.favoritesOnly
                )
                allItems.clear()
                allItems.addAll(items)
                _wardrobeState.value = UiState.Success(items)
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to load wardrobe items")
            }
        }
    }

    fun addItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.addItem(item)
                refreshWardrobe()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to add item")
            }
        }
    }

    fun addItemsBulk(items: List<ClothingItem>) {
        viewModelScope.launch {
            try {
                repository.addItemsBulk(items)
                refreshWardrobe()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to add items")
            }
        }
    }

    fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String) {
        _imageUploadState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val url = repository.uploadImage(bytes, fileName, mimeType)
                _imageUploadState.value = UiState.Success(url)
            } catch (_: Exception) {
                _imageUploadState.value = UiState.Error("Failed to upload image")
            }
        }
    }

    fun uploadImagesBatch(payloads: List<UploadImagePayload>) {
        if (payloads.isEmpty()) {
            _batchImageUploadState.value = UiState.Success(emptyList())
            return
        }
        _batchImageUploadState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val result = repository.uploadImagesBatch(payloads)
                _batchImageUploadState.value = UiState.Success(result)
            } catch (_: Exception) {
                _batchImageUploadState.value = UiState.Error("Failed to upload images")
            }
        }
    }

    fun clearBatchUploadState() {
        _batchImageUploadState.value = UiState.Success(emptyList())
    }

    fun deleteItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.deleteItem(item)
                refreshWardrobe()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to delete item")
            }
        }
    }

    fun updateItem(item: ClothingItem) {
        viewModelScope.launch {
            try {
                repository.updateItem(item)
                refreshWardrobe()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to update item")
            }
        }
    }

    fun fetchRecommendations(
        manualTemp: Int? = null,
        timeContext: String? = null,
        planDate: String? = null,
        exclude: String? = null,
        weatherCity: String? = null,
        weatherLat: Double? = null,
        weatherLon: Double? = null,
        weatherCategory: String? = null,
        occasion: String? = null
    ) {
        _recommendationState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val recommendations = repository.getRecommendations(
                    manualTemp = manualTemp,
                    timeContext = timeContext,
                    planDate = planDate,
                    exclude = exclude,
                    weatherCity = weatherCity,
                    weatherLat = weatherLat,
                    weatherLon = weatherLon,
                    weatherCategory = weatherCategory,
                    occasion = occasion
                )
                _recommendationState.value = UiState.Success(recommendations)
            } catch (_: Exception) {
                _recommendationState.value = UiState.Error("Failed to load recommendations")
            }
        }
    }

    fun fetchWeather(city: String? = null, lat: Double? = null, lon: Double? = null) {
        if ((city == null || city.isBlank()) && (lat == null || lon == null)) {
            _weatherState.value = UiState.Success(null)
            return
        }

        _weatherState.value = UiState.Loading
        viewModelScope.launch {
            try {
                _weatherState.value = UiState.Success(
                    repository.getCurrentWeather(
                        city = city?.trim()?.takeIf { it.isNotEmpty() },
                        lat = lat,
                        lon = lon
                    )
                )
            } catch (_: Exception) {
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
                refreshWardrobe()
                fetchRecommendations()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to update wear history")
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
            } catch (_: Exception) {
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
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to remove saved outfit")
            }
        }
    }

    fun toggleFavorite(itemId: Int) {
        val item = allItems.firstOrNull { it.id == itemId } ?: return
        viewModelScope.launch {
            try {
                repository.setFavorite(itemId = itemId, isFavorite = !item.isFavorite)
                refreshWardrobe()
            } catch (_: Exception) {
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
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to plan outfit")
            }
        }
    }

    fun assignCurrentRecommendationToDates(
        plannedDates: List<String>,
        occasion: String?,
        replaceExisting: Boolean
    ) {
        val recommendation = (recommendationState.value as? UiState.Success)?.data.orEmpty()
        if (recommendation.isEmpty()) return
        viewModelScope.launch {
            try {
                repository.assignOutfitToDates(
                    itemIds = recommendation.map { it.id },
                    plannedDates = plannedDates,
                    occasion = occasion,
                    replaceExisting = replaceExisting
                )
                refreshPlannedOutfits()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to assign outfit plan")
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
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to remove planned outfit")
            }
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            try {
                repository.clearOutfitHistory()
                refreshHistory()
            } catch (_: Exception) {
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
        val comfortText = if (item.comfortLevel >= 4) "high comfort" else "moderate comfort"
        val brandText = item.brand?.let { "from $it" } ?: ""
        return "This $brandText piece works well for ${item.season.lowercase()} and provides $comfortText."
    }
}
