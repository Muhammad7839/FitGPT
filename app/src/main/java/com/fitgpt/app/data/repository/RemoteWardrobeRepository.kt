/**
 * Retrofit-backed wardrobe repository used by the production app flow.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.DuplicateCandidate
import com.fitgpt.app.data.model.ForecastRecommendationResult
import com.fitgpt.app.data.model.ForecastWeatherContext
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.TagSuggestion
import com.fitgpt.app.data.model.UnderusedAlertsResult
import com.fitgpt.app.data.model.TripPackingResult
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WardrobeGapAnalysis
import com.fitgpt.app.data.model.WeatherSnapshot
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.toCreateRequest
import com.fitgpt.app.data.remote.toDomain
import com.fitgpt.app.data.remote.dto.BulkCreateClothingItemsRequestDto
import com.fitgpt.app.data.remote.dto.FavoriteToggleRequestDto
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.OutfitHistoryUpdateRequestDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitAssignmentRequestDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.PromptFeedbackEventRequestDto
import com.fitgpt.app.data.remote.dto.RecommendationFeedbackRequestDto
import com.fitgpt.app.data.remote.dto.RejectOutfitRequestDto
import com.fitgpt.app.data.remote.dto.SavedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.AiRecommendationRequestDto
import com.fitgpt.app.data.remote.dto.TripPackingRequestDto
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody

class RemoteWardrobeRepository(
    private val api: ApiService
) : WardrobeRepository {
    private var cachedItemsById = emptyMap<Int, ClothingItem>()

    override suspend fun getWardrobeItems(
        includeArchived: Boolean,
        search: String?,
        category: String?,
        color: String?,
        clothingType: String?,
        season: String?,
        fitTag: String?,
        layerType: String?,
        isOnePiece: Boolean?,
        setIdentifier: String?,
        styleTag: String?,
        seasonTag: String?,
        occasionTag: String?,
        accessoryType: String?,
        favoritesOnly: Boolean
    ): List<ClothingItem> {
        val items = api.getWardrobeItems(
            includeArchived = includeArchived,
            search = search,
            category = category,
            color = color,
            clothingType = clothingType,
            season = season,
            fitTag = fitTag,
            layerType = layerType,
            isOnePiece = isOnePiece,
            setIdentifier = setIdentifier,
            styleTag = styleTag,
            seasonTag = seasonTag,
            occasionTag = occasionTag,
            accessoryType = accessoryType,
            favoritesOnly = favoritesOnly
        ).map { dto ->
            dto.toDomain().copy(imageUrl = resolveApiUrl(dto.imageUrl))
        }
        cachedItemsById = cachedItemsById + items.associateBy { it.id }
        return items
    }

    override suspend fun addItem(item: ClothingItem) {
        api.addWardrobeItem(item.toCreateRequest())
    }

    override suspend fun addItemWithPhoto(item: ClothingItem, photo: UploadImagePayload): ClothingItem {
        val imagePart = MultipartBody.Part.createFormData(
            name = "image",
            filename = photo.fileName,
            body = photo.bytes.toRequestBody(photo.mimeType.toMediaTypeOrNull())
        )
        val created = api.addWardrobeItemMultipart(
            payload = buildMultipartItemFields(item),
            image = imagePart
        ).toDomain()
        return created.copy(imageUrl = resolveApiUrl(created.imageUrl))
    }

    override suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem> {
        val response = api.addWardrobeItemsBulk(
            BulkCreateClothingItemsRequestDto(items = items.map { it.toCreateRequest() })
        )
        return response.results.mapNotNull { it.item?.toDomain() }
    }

    override suspend fun suggestTags(item: ClothingItem): TagSuggestion {
        return api.suggestWardrobeTags(item.toCreateRequest()).toDomain()
    }

    override suspend fun getItemTagSuggestions(itemId: Int): TagSuggestion {
        return api.getWardrobeItemTagSuggestions(itemId).toDomain()
    }

    override suspend fun applyItemTagSuggestions(itemId: Int): ClothingItem {
        val updated = api.applyWardrobeItemTagSuggestions(itemId).toDomain()
        return updated.copy(imageUrl = resolveApiUrl(updated.imageUrl))
    }

    override suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String {
        val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData(
            name = "image",
            filename = fileName,
            body = body
        )
        return resolveApiUrl(api.uploadWardrobeImage(part).imageUrl).orEmpty()
    }

    override suspend fun uploadImagesBatch(images: List<UploadImagePayload>): List<UploadResult> {
        val parts = images.map { payload ->
            MultipartBody.Part.createFormData(
                name = "images",
                filename = payload.fileName,
                body = payload.bytes.toRequestBody(payload.mimeType.toMediaTypeOrNull())
            )
        }
        return api.uploadWardrobeImages(parts).results.map {
            UploadResult(
                fileName = it.fileName,
                status = it.status,
                imageUrl = resolveApiUrl(it.imageUrl),
                error = it.error
            )
        }
    }

    override suspend fun deleteItem(item: ClothingItem) {
        api.deleteWardrobeItem(item.id)
    }

    override suspend fun updateItem(item: ClothingItem) {
        api.updateWardrobeItem(item.id, item.toCreateRequest())
    }

    override suspend fun setFavorite(itemId: Int, isFavorite: Boolean): ClothingItem {
        return api.toggleWardrobeFavorite(
            itemId = itemId,
            payload = FavoriteToggleRequestDto(isFavorite = isFavorite)
        ).toDomain()
    }

    override suspend fun getFavoriteItems(): List<ClothingItem> {
        return api.getFavoriteWardrobeItems().map { dto ->
            dto.toDomain().copy(imageUrl = resolveApiUrl(dto.imageUrl))
        }
    }

    override suspend fun getWardrobeGaps(): WardrobeGapAnalysis {
        return api.getWardrobeGaps().toDomain()
    }

    override suspend fun getUnderusedAlerts(analysisWindowDays: Int, maxResults: Int): UnderusedAlertsResult {
        return api.getUnderusedAlerts(
            analysisWindowDays = analysisWindowDays,
            maxResults = maxResults
        ).toDomain()
    }

    override suspend fun getDuplicateCandidates(threshold: Float, limit: Int): List<DuplicateCandidate> {
        val activeItems = if (cachedItemsById.isEmpty()) {
            getWardrobeItems(includeArchived = true)
        } else {
            cachedItemsById.values.toList()
        }
        val itemsById = activeItems.associateBy { it.id }
        return api.getDuplicateCandidates(
            threshold = threshold,
            limit = limit
        ).candidates.mapNotNull { candidate ->
            val primary = itemsById[candidate.itemId] ?: return@mapNotNull null
            val duplicate = itemsById[candidate.duplicateItemId] ?: return@mapNotNull null
            DuplicateCandidate(
                item = primary,
                duplicateItem = duplicate,
                similarityScore = candidate.similarityScore,
                reasons = candidate.reasons
            )
        }
    }

    override suspend fun getRecommendations(
        manualTemp: Int?,
        timeContext: String?,
        planDate: String?,
        exclude: String?,
        weatherCity: String?,
        weatherLat: Double?,
        weatherLon: Double?,
        weatherCategory: String?,
        occasion: String?
    ): List<ClothingItem> {
        return api.getRecommendations(
            manualTemp = manualTemp,
            timeContext = timeContext,
            planDate = planDate,
            exclude = exclude,
            weatherCity = weatherCity,
            weatherLat = weatherLat,
            weatherLon = weatherLon,
            weatherCategory = weatherCategory,
            occasion = occasion
        ).items.map { dto ->
            dto.toDomain().copy(imageUrl = resolveApiUrl(dto.imageUrl))
        }
    }

    override suspend fun getRecommendationOptions(
        manualTemp: Int?,
        timeContext: String?,
        planDate: String?,
        exclude: String?,
        weatherCity: String?,
        weatherLat: Double?,
        weatherLon: Double?,
        weatherCategory: String?,
        occasion: String?,
        limit: Int
    ): List<OutfitOption> {
        return api.getRecommendationOptions(
            manualTemp = manualTemp,
            timeContext = timeContext,
            planDate = planDate,
            exclude = exclude,
            weatherCity = weatherCity,
            weatherLat = weatherLat,
            weatherLon = weatherLon,
            weatherCategory = weatherCategory,
            occasion = occasion,
            limit = limit
        ).outfits.map { option ->
            OutfitOption(
                items = option.items.map { dto -> dto.toDomain().copy(imageUrl = resolveApiUrl(dto.imageUrl)) },
                explanation = option.explanation,
                outfitScore = option.confidenceScore ?: option.outfitScore
            )
        }
    }

    override suspend fun getAiRecommendation(
        manualTemp: Int?,
        timeContext: String?,
        planDate: String?,
        exclude: String?,
        weatherCity: String?,
        weatherLat: Double?,
        weatherLon: Double?,
        weatherCategory: String?,
        occasion: String?,
        stylePreference: String?,
        preferredSeasons: List<String>
    ): AiRecommendationResult {
        val response = api.getAiRecommendations(
            AiRecommendationRequestDto(
                manualTemp = manualTemp,
                timeContext = timeContext,
                planDate = planDate,
                exclude = exclude,
                weatherCity = weatherCity,
                weatherLat = weatherLat,
                weatherLon = weatherLon,
                weatherCategory = weatherCategory,
                occasion = occasion,
                stylePreference = stylePreference,
                preferredSeasons = preferredSeasons
            )
        ).toDomain()
        return response.copy(
            items = response.items.map { item ->
                item.copy(imageUrl = resolveApiUrl(item.imageUrl))
            }
        )
    }

    override suspend fun rejectRecommendation(itemIds: List<Int>, suggestionId: String?) {
        api.rejectRecommendation(
            RejectOutfitRequestDto(
                itemIds = itemIds,
                suggestionId = suggestionId
            )
        )
    }

    override suspend fun recordPromptFeedbackEvent(eventType: String, suggestionId: String?) {
        api.recordPromptFeedbackEvent(
            PromptFeedbackEventRequestDto(
                eventType = eventType,
                suggestionId = suggestionId
            )
        )
    }

    override suspend fun submitRecommendationFeedback(
        suggestionId: String,
        signal: String,
        itemIds: List<Int>?
    ) {
        api.submitRecommendationFeedback(
            RecommendationFeedbackRequestDto(
                suggestionId = suggestionId,
                signal = signal,
                itemIds = itemIds
            )
        )
    }

    override suspend fun getForecastRecommendation(
        city: String?,
        hoursAhead: Int,
        manualTemp: Int?,
        weatherCategory: String?,
        occasion: String?,
        exclude: String?,
        stylePreference: String?,
        preferredSeasons: List<String>
    ): ForecastRecommendationResult {
        val response = api.getForecastRecommendation(
            city = city?.trim()?.takeIf { it.isNotEmpty() },
            hoursAhead = hoursAhead,
            manualTemp = manualTemp,
            weatherCategory = weatherCategory,
            occasion = occasion,
            exclude = exclude,
            stylePreference = stylePreference,
            preferredSeasons = preferredSeasons
        )
        return ForecastRecommendationResult(
            items = response.items.map { dto -> dto.toDomain().copy(imageUrl = resolveApiUrl(dto.imageUrl)) },
            explanation = response.explanation,
            outfitScore = response.outfitScore,
            source = response.source,
            fallbackUsed = response.fallbackUsed,
            warning = response.warning,
            suggestionId = response.suggestionId,
            forecast = ForecastWeatherContext(
                city = response.forecast.city,
                forecastTimestamp = response.forecast.forecastTimestamp,
                temperatureF = response.forecast.temperatureF,
                weatherCategory = response.forecast.weatherCategory,
                condition = response.forecast.condition,
                description = response.forecast.description,
                windMph = response.forecast.windMph,
                rainMm = response.forecast.rainMm,
                snowMm = response.forecast.snowMm,
                source = response.forecast.source
            )
        )
    }

    override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
        val response = api.getCurrentWeather(city = city, lat = lat, lon = lon)
        return WeatherSnapshot(
            city = response.city,
            temperatureF = response.temperatureF,
            weatherCategory = response.weatherCategory,
            condition = response.condition,
            description = response.description,
            available = response.available,
            detail = response.detail
        )
    }

    override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
        api.saveOutfitHistory(
            OutfitHistoryRequest(
                itemIds = items.map { it.id },
                wornAtTimestamp = wornAtTimestamp
            )
        )
    }

    override suspend fun getOutfitHistory(): List<OutfitHistoryEntry> {
        return api.getOutfitHistory().history.map { entry ->
            OutfitHistoryEntry(
                id = entry.id.toLong(),
                items = mapItemIds(entry.itemIds),
                wornAtTimestamp = entry.wornAtTimestamp
            )
        }
    }

    override suspend fun getOutfitHistoryInRange(startDate: String, endDate: String): List<OutfitHistoryEntry> {
        return api.getOutfitHistoryInRange(startDate = startDate, endDate = endDate).history.map { entry ->
            OutfitHistoryEntry(
                id = entry.id.toLong(),
                items = mapItemIds(entry.itemIds),
                wornAtTimestamp = entry.wornAtTimestamp
            )
        }
    }

    override suspend fun updateOutfitHistoryEntry(historyId: Long, itemIds: List<Int>?, wornAtTimestamp: Long?) {
        val updated = api.updateOutfitHistoryEntry(
            historyId = historyId,
            payload = OutfitHistoryUpdateRequestDto(
                itemIds = itemIds,
                wornAtTimestamp = wornAtTimestamp
            )
        )
        cachedItemsById = cachedItemsById + mapItemIds(updated.itemIds).associateBy { it.id }
    }

    override suspend fun deleteOutfitHistoryEntry(historyId: Long) {
        api.deleteOutfitHistoryEntry(historyId)
    }

    override suspend fun clearOutfitHistory() {
        api.clearOutfitHistory()
    }

    override suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long?) {
        api.saveOutfit(
            SavedOutfitCreateRequest(
                itemIds = itemIds,
                savedAtTimestamp = savedAtTimestamp
            )
        )
    }

    override suspend fun getSavedOutfits(): List<SavedOutfit> {
        return api.getSavedOutfits().outfits.map { outfit ->
            SavedOutfit(
                id = outfit.id,
                items = mapItemIds(outfit.itemIds),
                savedAtTimestamp = outfit.savedAtTimestamp
            )
        }
    }

    override suspend fun removeSavedOutfit(outfitId: Int) {
        api.deleteSavedOutfit(outfitId)
    }

    override suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String) {
        api.savePlannedOutfit(
            PlannedOutfitCreateRequest(
                itemIds = itemIds,
                plannedDate = planDate,
                occasion = occasion.ifBlank { null }
            )
        )
    }

    override suspend fun assignOutfitToDates(
        itemIds: List<Int>,
        plannedDates: List<String>,
        occasion: String?,
        replaceExisting: Boolean
    ) {
        api.assignPlannedOutfit(
            PlannedOutfitAssignmentRequestDto(
                itemIds = itemIds,
                plannedDates = plannedDates,
                occasion = occasion?.takeIf { it.isNotBlank() },
                replaceExisting = replaceExisting
            )
        )
    }

    override suspend fun generateTripPackingList(
        destinationCity: String,
        startDate: String,
        tripDays: Int
    ): TripPackingResult {
        return api.generateTripPackingList(
            TripPackingRequestDto(
                destinationCity = destinationCity,
                startDate = startDate,
                tripDays = tripDays
            )
        ).toDomain()
    }

    override suspend fun getPlannedOutfits(): List<PlannedOutfit> {
        return api.getPlannedOutfits().outfits.map { outfit ->
            PlannedOutfit(
                id = outfit.id.toLong(),
                items = mapItemIds(outfit.itemIds),
                planDate = outfit.plannedDate,
                occasion = outfit.occasion.orEmpty(),
                createdAtTimestamp = outfit.createdAtTimestamp
            )
        }
    }

    override suspend fun removePlannedOutfit(outfitId: Long) {
        api.deletePlannedOutfit(outfitId)
    }

    private fun mapItemIds(itemIds: List<Int>): List<ClothingItem> {
        return itemIds.map { itemId ->
            cachedItemsById[itemId] ?: ClothingItem(
                id = itemId,
                category = "Item #$itemId",
                color = "Unknown",
                season = "All",
                comfortLevel = 3
            )
        }
    }

    private fun buildMultipartItemFields(item: ClothingItem): Map<String, RequestBody> {
        val fields = linkedMapOf<String, RequestBody>()
        fields.putText("category", item.category.ifBlank { "Top" })
        fields.putText("color", item.color.ifBlank { "Unknown" })
        fields.putText("season", item.season.ifBlank { "All" })
        fields.putText("comfort_level", item.comfortLevel.coerceIn(1, 5).toString())

        item.name?.takeIf { it.isNotBlank() }?.let { fields.putText("name", it) }
        item.clothingType?.takeIf { it.isNotBlank() }?.let { fields.putText("clothing_type", it) }
        item.layerType?.takeIf { it.isNotBlank() }?.let { fields.putText("layer_type", it) }
        item.fitTag?.takeIf { it.isNotBlank() }?.let { fields.putText("fit_tag", it) }
        item.setIdentifier?.takeIf { it.isNotBlank() }?.let { fields.putText("set_identifier", it) }
        item.accessoryType?.takeIf { it.isNotBlank() }?.let { fields.putText("accessory_type", it) }
        item.brand?.takeIf { it.isNotBlank() }?.let { fields.putText("brand", it) }

        item.colors.takeIf { it.isNotEmpty() }?.let { fields.putText("colors", it.joinToString(",")) }
        item.seasonTags.takeIf { it.isNotEmpty() }?.let { fields.putText("season_tags", it.joinToString(",")) }
        item.styleTags.takeIf { it.isNotEmpty() }?.let { fields.putText("style_tags", it.joinToString(",")) }
        item.occasionTags.takeIf { it.isNotEmpty() }?.let { fields.putText("occasion_tags", it.joinToString(",")) }

        fields.putText("is_one_piece", item.isOnePiece.toString())
        fields.putText("is_available", item.isAvailable.toString())
        fields.putText("is_favorite", item.isFavorite.toString())
        fields.putText("is_archived", item.isArchived.toString())
        item.lastWornTimestamp?.let { fields.putText("last_worn_timestamp", it.toString()) }
        return fields
    }

    private fun MutableMap<String, RequestBody>.putText(key: String, value: String) {
        this[key] = value.toRequestBody("text/plain".toMediaType())
    }
}
