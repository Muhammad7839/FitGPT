package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WeatherSnapshot

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
    private val historyEntries = mutableListOf<OutfitHistoryEntry>()
    private val plannedOutfits = mutableListOf<PlannedOutfit>()

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
        val normalizedSearch = search?.trim()?.lowercase().orEmpty()
        return wardrobeItems
            .asSequence()
            .filter { includeArchived || !it.isArchived }
            .filter { !favoritesOnly || it.isFavorite }
            .filter { category.isNullOrBlank() || it.category.contains(category, ignoreCase = true) }
            .filter { color.isNullOrBlank() || it.color.contains(color, ignoreCase = true) }
            .filter { clothingType.isNullOrBlank() || (it.clothingType ?: "").contains(clothingType, ignoreCase = true) }
            .filter { season.isNullOrBlank() || it.season.contains(season, ignoreCase = true) }
            .filter { fitTag.isNullOrBlank() || (it.fitTag ?: "").contains(fitTag, ignoreCase = true) }
            .filter { layerType.isNullOrBlank() || (it.layerType ?: "").contains(layerType, ignoreCase = true) }
            .filter { isOnePiece == null || it.isOnePiece == isOnePiece }
            .filter { setIdentifier.isNullOrBlank() || (it.setIdentifier ?: "").contains(setIdentifier, ignoreCase = true) }
            .filter { styleTag.isNullOrBlank() || it.styleTags.any { tag -> tag.contains(styleTag, ignoreCase = true) } }
            .filter { seasonTag.isNullOrBlank() || it.seasonTags.any { tag -> tag.contains(seasonTag, ignoreCase = true) } }
            .filter { occasionTag.isNullOrBlank() || it.occasionTags.any { tag -> tag.contains(occasionTag, ignoreCase = true) } }
            .filter { accessoryType.isNullOrBlank() || (it.accessoryType ?: "").contains(accessoryType, ignoreCase = true) }
            .filter {
                normalizedSearch.isBlank() ||
                    listOfNotNull(it.name, it.category, it.color, it.season, it.clothingType, it.fitTag, it.brand)
                        .joinToString(" ")
                        .lowercase()
                        .contains(normalizedSearch)
            }
            .toList()
    }

    override suspend fun addItem(item: ClothingItem) {
        wardrobeItems.add(item)
    }

    override suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem> {
        wardrobeItems.addAll(items)
        return items
    }

    override suspend fun uploadImage(bytes: ByteArray, fileName: String, mimeType: String): String {
        return "https://example.com/uploads/$fileName"
    }

    override suspend fun uploadImagesBatch(images: List<UploadImagePayload>): List<UploadResult> {
        return images.map { image ->
            UploadResult(
                fileName = image.fileName,
                status = "success",
                imageUrl = "https://example.com/uploads/${image.fileName}",
                error = null
            )
        }
    }

    override suspend fun deleteItem(item: ClothingItem) {
        // Soft delete (archive instead of remove)
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = wardrobeItems[index].copy(
                isArchived = true
            )
        }
    }

    override suspend fun updateItem(item: ClothingItem) {
        val index = wardrobeItems.indexOfFirst { it.id == item.id }
        if (index != -1) {
            wardrobeItems[index] = item
        }
    }

    override suspend fun setFavorite(itemId: Int, isFavorite: Boolean): ClothingItem {
        val index = wardrobeItems.indexOfFirst { it.id == itemId }
        if (index == -1) error("item not found")
        val updated = wardrobeItems[index].copy(isFavorite = isFavorite)
        wardrobeItems[index] = updated
        return updated
    }

    override suspend fun getFavoriteItems(): List<ClothingItem> {
        return wardrobeItems.filter { it.isFavorite && !it.isArchived }
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
        val available = wardrobeItems
            .filter { it.isAvailable && !it.isArchived }
            .sortedBy { it.lastWornTimestamp ?: 0L }
        val tops = available.filter { it.category.equals("Top", true) }
        val bottoms = available.filter { it.category.equals("Bottom", true) }
        val shoes = available.filter { it.category.equals("Shoes", true) }
        return listOfNotNull(tops.firstOrNull(), bottoms.firstOrNull(), shoes.firstOrNull())
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
        val items = getRecommendations(
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
        return AiRecommendationResult(
            items = items,
            explanation = "Fallback recommendation generated from local repository.",
            outfitScore = 0.72f,
            source = "fallback",
            fallbackUsed = true,
            warning = "fake_repository",
            weatherCategory = weatherCategory ?: "mild",
            occasion = occasion,
            suggestionId = items.map { it.id }.sorted().joinToString(","),
            itemExplanations = emptyMap(),
            outfitOptions = listOf(
                OutfitOption(
                    items = items,
                    explanation = "Fallback recommendation generated from local repository.",
                    outfitScore = 0.72f
                )
            )
        )
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
        val items = getRecommendations(
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
        return listOf(
            OutfitOption(
                items = items,
                explanation = "Fallback option from fake repository.",
                outfitScore = 0.72f
            )
        ).take(limit.coerceAtLeast(1))
    }

    override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
        return WeatherSnapshot(
            city = city ?: "Current location",
            temperatureF = 72,
            weatherCategory = "warm",
            condition = "Clear",
            description = "clear sky"
        )
    }

    override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
        items.forEach { item ->
            val index = wardrobeItems.indexOfFirst { it.id == item.id }
            if (index != -1) {
                wardrobeItems[index] = wardrobeItems[index].copy(
                    lastWornTimestamp = wornAtTimestamp
                )
            }
        }
        historyEntries.add(
            0,
            OutfitHistoryEntry(
                id = wornAtTimestamp,
                items = items,
                wornAtTimestamp = wornAtTimestamp
            )
        )
    }

    override suspend fun getOutfitHistory(): List<OutfitHistoryEntry> {
        return historyEntries.toList()
    }

    override suspend fun clearOutfitHistory() {
        historyEntries.clear()
    }

    override suspend fun saveOutfit(itemIds: List<Int>, savedAtTimestamp: Long?) {
        val outfitItems = wardrobeItems.filter { itemIds.contains(it.id) }
        savedOutfits.add(
            0,
            SavedOutfit(
                id = (savedAtTimestamp ?: System.currentTimeMillis()).toInt(),
                items = outfitItems
            )
        )
    }

    override suspend fun getSavedOutfits(): List<SavedOutfit> {
        return savedOutfits.toList()
    }

    override suspend fun removeSavedOutfit(outfitId: Int) {
        savedOutfits.removeAll { it.id == outfitId }
    }

    override suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String) {
        val outfitItems = wardrobeItems.filter { itemIds.contains(it.id) }
        plannedOutfits.add(
            0,
            PlannedOutfit(
                id = System.currentTimeMillis(),
                items = outfitItems,
                planDate = planDate,
                occasion = occasion
            )
        )
    }

    override suspend fun assignOutfitToDates(
        itemIds: List<Int>,
        plannedDates: List<String>,
        occasion: String?,
        replaceExisting: Boolean
    ) {
        plannedDates.forEach { date ->
            if (replaceExisting) {
                plannedOutfits.removeAll { it.planDate == date }
            }
            val outfitItems = wardrobeItems.filter { itemIds.contains(it.id) }
            plannedOutfits.add(
                0,
                PlannedOutfit(
                    id = System.currentTimeMillis(),
                    items = outfitItems,
                    planDate = date,
                    occasion = occasion.orEmpty()
                )
            )
        }
    }

    override suspend fun getPlannedOutfits(): List<PlannedOutfit> {
        return plannedOutfits.toList()
    }

    override suspend fun removePlannedOutfit(outfitId: Long) {
        plannedOutfits.removeAll { it.id == outfitId }
    }
}
