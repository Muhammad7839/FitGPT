/**
 * Coordinates wardrobe CRUD, recommendations, and outfit workflow actions for UI screens.
 */
package com.fitgpt.app.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.TagSuggestion
import com.fitgpt.app.data.model.UnderusedAlertsResult
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WardrobeGapAnalysis
import com.fitgpt.app.data.model.WeatherSnapshot
import com.fitgpt.app.data.repository.UploadImagePayload
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class WardrobeFilters(
    val includeArchived: Boolean = true,
    val search: String? = null,
    val category: String? = null,
    val color: String? = null,
    val clothingType: String? = null,
    val season: String? = null,
    val fitTag: String? = null,
    val layerType: String? = null,
    val isOnePiece: Boolean? = null,
    val setIdentifier: String? = null,
    val styleTag: String? = null,
    val seasonTag: String? = null,
    val occasionTag: String? = null,
    val accessoryType: String? = null,
    val favoritesOnly: Boolean = false
)

enum class WeatherStatusType {
    IDLE,
    LOADING,
    USING_LOCATION,
    PERMISSION_NEEDED,
    MANUAL_CITY_FALLBACK,
    UNAVAILABLE,
    AVAILABLE
}

enum class WeatherRequestSource {
    AUTO_DASHBOARD,
    LOCATION,
    MANUAL_CITY
}

data class WeatherUiStatus(
    val type: WeatherStatusType,
    val message: String
)

data class RecommendationMeta(
    val explanation: String = "",
    val outfitScore: Float = 0f,
    val source: String = "fallback",
    val fallbackUsed: Boolean = true,
    val warning: String? = null,
    val weatherCategory: String? = null,
    val occasion: String? = null,
    val suggestionId: String? = null,
    val itemExplanations: Map<Int, String> = emptyMap(),
    val promptFeedback: PromptFeedbackUiMeta? = null
)

data class PromptFeedbackUiMeta(
    val shouldPrompt: Boolean,
    val reason: String,
    val cooldownSecondsRemaining: Int
)

enum class ImageUploadTarget {
    ADD_ITEM,
    EDIT_ITEM
}

class WardrobeViewModel(
    private val repository: WardrobeRepository
) : ViewModel() {
    private val weatherLogTag = "FitGPTWeather"
    private val recommendationLogTag = "FitGPTRecommendation"

    private val allItems = mutableListOf<ClothingItem>()
    private var currentFilters = WardrobeFilters()
    private var latestWeatherSnapshot: WeatherSnapshot? = null

    private val _wardrobeState = MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)
    val wardrobeState: StateFlow<UiState<List<ClothingItem>>> = _wardrobeState

    private val _recommendationState = MutableStateFlow<UiState<List<ClothingItem>>>(UiState.Loading)
    val recommendationState: StateFlow<UiState<List<ClothingItem>>> = _recommendationState
    private val _recommendationMeta = MutableStateFlow(RecommendationMeta())
    val recommendationMeta: StateFlow<RecommendationMeta> = _recommendationMeta
    private val _recommendationOptionsState = MutableStateFlow<List<OutfitOption>>(emptyList())
    val recommendationOptionsState: StateFlow<List<OutfitOption>> = _recommendationOptionsState

    private val _historyState = MutableStateFlow<List<OutfitHistoryEntry>>(emptyList())
    val historyState: StateFlow<List<OutfitHistoryEntry>> = _historyState

    private val _plannedState = MutableStateFlow<List<PlannedOutfit>>(emptyList())
    val plannedState: StateFlow<List<PlannedOutfit>> = _plannedState

    private val _savedOutfitsState = MutableStateFlow<List<SavedOutfit>>(emptyList())
    val savedOutfitsState: StateFlow<List<SavedOutfit>> = _savedOutfitsState
    private val _wardrobeGapState =
        MutableStateFlow<UiState<WardrobeGapAnalysis?>>(UiState.Success(null))
    val wardrobeGapState: StateFlow<UiState<WardrobeGapAnalysis?>> = _wardrobeGapState
    private val _underusedAlertsState =
        MutableStateFlow<UiState<UnderusedAlertsResult?>>(UiState.Success(null))
    val underusedAlertsState: StateFlow<UiState<UnderusedAlertsResult?>> = _underusedAlertsState

    private val _addItemImageUploadState = MutableStateFlow<UiState<String?>>(UiState.Success(null))
    val addItemImageUploadState: StateFlow<UiState<String?>> = _addItemImageUploadState

    private val _editItemImageUploadState = MutableStateFlow<UiState<String?>>(UiState.Success(null))
    val editItemImageUploadState: StateFlow<UiState<String?>> = _editItemImageUploadState

    private val _batchImageUploadState =
        MutableStateFlow<UiState<List<UploadResult>>>(UiState.Success(emptyList()))
    val batchImageUploadState: StateFlow<UiState<List<UploadResult>>> = _batchImageUploadState

    private val _itemSaveState = MutableStateFlow<UiState<Int?>>(UiState.Success(null))
    val itemSaveState: StateFlow<UiState<Int?>> = _itemSaveState

    private val _itemUpdateState = MutableStateFlow<UiState<Int?>>(UiState.Success(null))
    val itemUpdateState: StateFlow<UiState<Int?>> = _itemUpdateState

    private val _bulkItemSaveState = MutableStateFlow<UiState<Int?>>(UiState.Success(null))
    val bulkItemSaveState: StateFlow<UiState<Int?>> = _bulkItemSaveState
    private val _tagSuggestionState = MutableStateFlow<UiState<TagSuggestion?>>(UiState.Success(null))
    val tagSuggestionState: StateFlow<UiState<TagSuggestion?>> = _tagSuggestionState

    private val _weatherState = MutableStateFlow<UiState<WeatherSnapshot?>>(UiState.Success(null))
    val weatherState: StateFlow<UiState<WeatherSnapshot?>> = _weatherState
    private val _weatherCityState = MutableStateFlow("")
    val weatherCityState: StateFlow<String> = _weatherCityState
    private val _weatherUiStatus = MutableStateFlow(
        WeatherUiStatus(
            type = WeatherStatusType.IDLE,
            message = "Weather not set"
        )
    )
    val weatherUiStatus: StateFlow<WeatherUiStatus> = _weatherUiStatus

    init {
        refreshWardrobe()
        fetchWardrobeGaps()
        fetchUnderusedAlerts()
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
                    layerType = currentFilters.layerType,
                    isOnePiece = currentFilters.isOnePiece,
                    setIdentifier = currentFilters.setIdentifier,
                    styleTag = currentFilters.styleTag,
                    seasonTag = currentFilters.seasonTag,
                    occasionTag = currentFilters.occasionTag,
                    accessoryType = currentFilters.accessoryType,
                    favoritesOnly = currentFilters.favoritesOnly
                )
                allItems.clear()
                allItems.addAll(items)
                _wardrobeState.value = UiState.Success(items)
                fetchWardrobeGaps()
                fetchUnderusedAlerts()
            } catch (_: Exception) {
                _wardrobeState.value = UiState.Error("Failed to load wardrobe items")
            }
        }
    }

    fun fetchWardrobeGaps() {
        _wardrobeGapState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val gaps = repository.getWardrobeGaps()
                _wardrobeGapState.value = UiState.Success(gaps)
            } catch (_: Exception) {
                _wardrobeGapState.value = UiState.Error("Failed to load wardrobe gaps")
            }
        }
    }

    fun fetchUnderusedAlerts(analysisWindowDays: Int = 21, maxResults: Int = 10) {
        _underusedAlertsState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val result = repository.getUnderusedAlerts(
                    analysisWindowDays = analysisWindowDays,
                    maxResults = maxResults
                )
                _underusedAlertsState.value = UiState.Success(result)
            } catch (_: Exception) {
                _underusedAlertsState.value = UiState.Error("Failed to load underused alerts")
            }
        }
    }

    fun addItem(item: ClothingItem) {
        _itemSaveState.value = UiState.Loading
        viewModelScope.launch {
            try {
                repository.addItem(item)
                _itemSaveState.value = UiState.Success(1)
                refreshWardrobe()
            } catch (exception: Exception) {
                Log.e(recommendationLogTag, "add item failed", exception)
                _itemSaveState.value = UiState.Error("Failed to save item")
            }
        }
    }

    fun addItemWithPhoto(item: ClothingItem, photo: UploadImagePayload) {
        _itemSaveState.value = UiState.Loading
        viewModelScope.launch {
            try {
                repository.addItemWithPhoto(item, photo)
                _itemSaveState.value = UiState.Success(1)
                refreshWardrobe()
            } catch (exception: Exception) {
                Log.e(recommendationLogTag, "add item with photo failed", exception)
                _itemSaveState.value = UiState.Error("Failed to save item")
            }
        }
    }

    fun addItemsBulk(items: List<ClothingItem>) {
        _bulkItemSaveState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val savedItems = repository.addItemsBulk(items)
                _bulkItemSaveState.value = UiState.Success(savedItems.size)
                refreshWardrobe()
            } catch (exception: Exception) {
                Log.e(recommendationLogTag, "bulk add item failed", exception)
                _bulkItemSaveState.value = UiState.Error("Failed to save uploaded items")
            }
        }
    }

    fun clearItemSaveState() {
        _itemSaveState.value = UiState.Success(null)
    }

    fun clearBulkItemSaveState() {
        _bulkItemSaveState.value = UiState.Success(null)
    }

    fun suggestTagsForDraft(item: ClothingItem) {
        _tagSuggestionState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val suggestion = repository.suggestTags(item)
                _tagSuggestionState.value = UiState.Success(suggestion)
            } catch (_: Exception) {
                _tagSuggestionState.value = UiState.Error("Failed to suggest tags")
            }
        }
    }

    fun clearTagSuggestionState() {
        _tagSuggestionState.value = UiState.Success(null)
    }

    fun uploadImage(
        bytes: ByteArray,
        fileName: String,
        mimeType: String,
        target: ImageUploadTarget = ImageUploadTarget.ADD_ITEM
    ) {
        setImageUploadState(target, UiState.Loading)
        viewModelScope.launch {
            try {
                val url = repository.uploadImage(bytes, fileName, mimeType)
                setImageUploadState(target, UiState.Success(url))
            } catch (_: Exception) {
                setImageUploadState(target, UiState.Error("Failed to upload image"))
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

    fun clearImageUploadState(target: ImageUploadTarget) {
        setImageUploadState(target, UiState.Success(null))
    }

    private fun setImageUploadState(target: ImageUploadTarget, value: UiState<String?>) {
        when (target) {
            ImageUploadTarget.ADD_ITEM -> _addItemImageUploadState.value = value
            ImageUploadTarget.EDIT_ITEM -> _editItemImageUploadState.value = value
        }
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
        _itemUpdateState.value = UiState.Loading
        viewModelScope.launch {
            try {
                repository.updateItem(item)
                _itemUpdateState.value = UiState.Success(item.id)
                refreshWardrobe()
            } catch (_: Exception) {
                _itemUpdateState.value = UiState.Error("Failed to update item")
            }
        }
    }

    fun clearItemUpdateState() {
        _itemUpdateState.value = UiState.Success(null)
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
        occasion: String? = null,
        stylePreference: String? = null,
        preferredSeasons: List<String> = emptyList()
    ) {
        _recommendationState.value = UiState.Loading
        viewModelScope.launch {
            val sharedWeatherCity = _weatherCityState.value.trim().takeIf { it.isNotEmpty() }
            try {
                val resolvedTemp = manualTemp ?: latestWeatherSnapshot?.temperatureF
                val resolvedWeatherCategory = weatherCategory ?: latestWeatherSnapshot?.weatherCategory
                val aiResult = repository.getAiRecommendation(
                    manualTemp = resolvedTemp,
                    timeContext = timeContext,
                    planDate = planDate,
                    exclude = exclude,
                    weatherCity = weatherCity?.trim()?.takeIf { it.isNotEmpty() } ?: sharedWeatherCity,
                    weatherLat = weatherLat,
                    weatherLon = weatherLon,
                    weatherCategory = resolvedWeatherCategory,
                    occasion = occasion,
                    stylePreference = stylePreference,
                    preferredSeasons = preferredSeasons
                )
                _recommendationMeta.value = RecommendationMeta(
                    explanation = aiResult.explanation,
                    outfitScore = aiResult.outfitScore,
                    source = aiResult.source,
                    fallbackUsed = aiResult.fallbackUsed,
                    warning = aiResult.warning,
                    weatherCategory = aiResult.weatherCategory,
                    occasion = aiResult.occasion,
                    suggestionId = aiResult.suggestionId,
                    itemExplanations = aiResult.itemExplanations,
                    promptFeedback = aiResult.promptFeedback?.let { prompt ->
                        PromptFeedbackUiMeta(
                            shouldPrompt = prompt.shouldPrompt,
                            reason = prompt.reason,
                            cooldownSecondsRemaining = prompt.cooldownSecondsRemaining
                        )
                    }
                )
                _recommendationOptionsState.value = aiResult.outfitOptions.ifEmpty {
                    listOf(
                        OutfitOption(
                            items = aiResult.items,
                            explanation = aiResult.explanation,
                            outfitScore = aiResult.outfitScore
                        )
                    )
                }
                _recommendationState.value = UiState.Success(aiResult.items)
                Log.i(
                    recommendationLogTag,
                    "source=${aiResult.source} fallback=${aiResult.fallbackUsed} warning=${aiResult.warning.orEmpty()}"
                )
            } catch (_: Exception) {
                Log.w(recommendationLogTag, "ai recommendation failed, falling back to legacy endpoint")
                try {
                    val recommendations = repository.getRecommendations(
                        manualTemp = manualTemp ?: latestWeatherSnapshot?.temperatureF,
                        timeContext = timeContext,
                        planDate = planDate,
                        exclude = exclude,
                        weatherCity = weatherCity?.trim()?.takeIf { it.isNotEmpty() } ?: sharedWeatherCity,
                        weatherLat = weatherLat,
                        weatherLon = weatherLon,
                        weatherCategory = weatherCategory ?: latestWeatherSnapshot?.weatherCategory,
                        occasion = occasion
                    )
                    _recommendationMeta.value = RecommendationMeta(
                        explanation = "Generated by compatibility recommendation engine.",
                        outfitScore = 0f,
                        source = "fallback",
                        fallbackUsed = true,
                        warning = "legacy_endpoint_fallback",
                        weatherCategory = weatherCategory ?: latestWeatherSnapshot?.weatherCategory,
                        occasion = occasion,
                        promptFeedback = null
                    )
                    _recommendationOptionsState.value = recommendations.takeIf { it.isNotEmpty() }?.let {
                        listOf(
                            OutfitOption(
                                items = it,
                                explanation = "Compatibility recommendation option",
                                outfitScore = 0f
                            )
                        )
                    } ?: emptyList()
                    _recommendationState.value = UiState.Success(recommendations)
                } catch (_: Exception) {
                    Log.e(recommendationLogTag, "legacy recommendation endpoint failed")
                    _recommendationState.value = UiState.Error("Failed to load recommendations")
                }
            }
        }
    }

    fun markWeatherPermissionNeeded() {
        _weatherUiStatus.value = WeatherUiStatus(
            type = WeatherStatusType.PERMISSION_NEEDED,
            message = "Permission needed"
        )
        Log.i(weatherLogTag, "permission needed for weather")
    }

    fun selectRecommendationOption(index: Int) {
        val options = _recommendationOptionsState.value
        if (index !in options.indices) return
        val selected = options[index]
        _recommendationState.value = UiState.Success(selected.items)
        _recommendationMeta.value = _recommendationMeta.value.copy(
            explanation = selected.explanation,
            outfitScore = selected.outfitScore
        )
    }

    fun recordPromptInteraction(eventType: String) {
        viewModelScope.launch {
            try {
                repository.recordPromptFeedbackEvent(
                    eventType = eventType,
                    suggestionId = _recommendationMeta.value.suggestionId
                )
                _recommendationMeta.value = _recommendationMeta.value.copy(
                    promptFeedback = _recommendationMeta.value.promptFeedback?.copy(shouldPrompt = false)
                )
            } catch (_: Exception) {
                // Prompt interaction logging should not block recommendation flows.
            }
        }
    }

    fun markWeatherManualFallback() {
        _weatherUiStatus.value = WeatherUiStatus(
            type = WeatherStatusType.MANUAL_CITY_FALLBACK,
            message = "City detection unavailable"
        )
        Log.i(weatherLogTag, "manual city fallback set")
    }

    fun setWeatherCityInput(city: String) {
        _weatherCityState.value = city.trimStart()
    }

    fun fetchWeather(
        city: String? = null,
        lat: Double? = null,
        lon: Double? = null,
        source: WeatherRequestSource = WeatherRequestSource.MANUAL_CITY
    ) {
        city?.trim()?.takeIf { it.isNotEmpty() }?.let { enteredCity ->
            _weatherCityState.value = enteredCity
        }
        if ((city == null || city.isBlank()) && (lat == null || lon == null)) {
            _weatherState.value = UiState.Success(latestWeatherSnapshot)
            _weatherUiStatus.value = WeatherUiStatus(
                type = if (latestWeatherSnapshot == null) WeatherStatusType.IDLE else WeatherStatusType.AVAILABLE,
                message = if (latestWeatherSnapshot == null) "Weather not set" else "Weather ready"
            )
            return
        }

        _weatherState.value = UiState.Loading
        _weatherUiStatus.value = WeatherUiStatus(
            type = when (source) {
                WeatherRequestSource.LOCATION, WeatherRequestSource.AUTO_DASHBOARD -> WeatherStatusType.USING_LOCATION
                WeatherRequestSource.MANUAL_CITY -> WeatherStatusType.LOADING
            },
            message = when (source) {
                WeatherRequestSource.LOCATION, WeatherRequestSource.AUTO_DASHBOARD -> "Using location"
                WeatherRequestSource.MANUAL_CITY -> "Loading"
            }
        )
        Log.i(
            weatherLogTag,
            "weather fetch start source=$source cityProvided=${!city.isNullOrBlank()} hasLatLon=${lat != null && lon != null}"
        )
        viewModelScope.launch {
            try {
                val weather = repository.getCurrentWeather(
                    city = city?.trim()?.takeIf { it.isNotEmpty() },
                    lat = lat,
                    lon = lon
                )
                latestWeatherSnapshot = weather
                _weatherCityState.value = weather.city
                _weatherState.value = UiState.Success(weather)
                _weatherUiStatus.value = WeatherUiStatus(
                    type = WeatherStatusType.AVAILABLE,
                    message = "Weather ready"
                )
                Log.i(weatherLogTag, "weather fetch success city=${weather.city} tempF=${weather.temperatureF}")
            } catch (exception: Exception) {
                val safeError = resolveWeatherErrorMessage(exception)
                when {
                    latestWeatherSnapshot != null -> {
                        _weatherState.value = UiState.Success(latestWeatherSnapshot)
                        _weatherUiStatus.value = WeatherUiStatus(
                            type = WeatherStatusType.UNAVAILABLE,
                            message = "Unavailable"
                        )
                    }
                    source == WeatherRequestSource.LOCATION || source == WeatherRequestSource.AUTO_DASHBOARD -> {
                        _weatherState.value = UiState.Success(null)
                        _weatherUiStatus.value = WeatherUiStatus(
                            type = WeatherStatusType.MANUAL_CITY_FALLBACK,
                            message = "City detection unavailable"
                        )
                    }
                    else -> {
                        _weatherState.value = UiState.Error(safeError)
                        _weatherUiStatus.value = WeatherUiStatus(
                            type = WeatherStatusType.UNAVAILABLE,
                            message = "Unavailable"
                        )
                    }
                }
                Log.w(weatherLogTag, "weather fetch failed source=$source reason=$safeError")
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

    fun rejectCurrentRecommendation() {
        val recommendation = (recommendationState.value as? UiState.Success)?.data.orEmpty()
        if (recommendation.isEmpty()) return
        viewModelScope.launch {
            try {
                repository.rejectRecommendation(
                    itemIds = recommendation.map { it.id },
                    suggestionId = recommendationMeta.value.suggestionId
                )
                fetchRecommendations(
                    manualTemp = latestWeatherSnapshot?.temperatureF,
                    weatherCategory = latestWeatherSnapshot?.weatherCategory,
                    weatherCity = weatherCityState.value.trim().takeIf { it.isNotEmpty() }
                )
            } catch (_: Exception) {
                _recommendationState.value = UiState.Error("Failed to submit feedback")
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
        _recommendationMeta.value.itemExplanations[item.id]?.let { detail ->
            return detail
        }
        val comfortText = if (item.comfortLevel >= 4) "high comfort" else "moderate comfort"
        val brandText = item.brand?.let { "from $it" } ?: ""
        return "This $brandText piece works well for ${item.season.lowercase()} and provides $comfortText."
    }

    private fun resolveWeatherErrorMessage(exception: Exception): String {
        return when (exception) {
            is HttpException -> {
                val errorBody = runCatching { exception.response()?.errorBody()?.string().orEmpty() }
                    .getOrDefault("")
                when {
                    errorBody.contains("quota", ignoreCase = true) -> "Weather service quota exceeded"
                    errorBody.contains("authentication", ignoreCase = true) -> "Weather service authentication failed"
                    errorBody.contains("not found", ignoreCase = true) -> "Requested location was not found"
                    exception.code() == 400 -> "Requested location was not found"
                    exception.code() == 401 -> "Weather service authentication failed"
                    exception.code() == 429 -> "Weather service quota exceeded"
                    exception.code() == 502 || exception.code() == 503 -> "Weather service unavailable"
                    else -> "Weather unavailable"
                }
            }
            else -> "Weather unavailable"
        }
    }
}
