/**
 * Retrofit-backed wardrobe repository used by the production app flow.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WeatherSnapshot
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.toCreateRequest
import com.fitgpt.app.data.remote.toDomain
import com.fitgpt.app.data.remote.dto.BulkCreateClothingItemsRequestDto
import com.fitgpt.app.data.remote.dto.FavoriteToggleRequestDto
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.PlannedOutfitAssignmentRequestDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.AiRecommendationRequestDto
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
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

    override suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem> {
        val response = api.addWardrobeItemsBulk(
            BulkCreateClothingItemsRequestDto(items = items.map { it.toCreateRequest() })
        )
        return response.results.mapNotNull { it.item?.toDomain() }
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
                outfitScore = option.outfitScore
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

    override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
        val response = api.getCurrentWeather(city = city, lat = lat, lon = lon)
        return WeatherSnapshot(
            city = response.city,
            temperatureF = response.temperatureF,
            weatherCategory = response.weatherCategory,
            condition = response.condition,
            description = response.description
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
                items = mapItemIds(outfit.itemIds)
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
}
