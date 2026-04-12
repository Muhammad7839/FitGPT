package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.AiRecommendationResult
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.model.DuplicateCandidate
import com.fitgpt.app.data.model.ForecastRecommendationResult
import com.fitgpt.app.data.model.ForecastWeatherContext
import com.fitgpt.app.data.model.OutfitHistoryEntry
import com.fitgpt.app.data.model.OutfitOption
import com.fitgpt.app.data.model.PlannedOutfit
import com.fitgpt.app.data.model.SavedOutfit
import com.fitgpt.app.data.model.TagSuggestion
import com.fitgpt.app.data.model.UnderusedAlert
import com.fitgpt.app.data.model.UnderusedAlertsResult
import com.fitgpt.app.data.model.TripPackingItem
import com.fitgpt.app.data.model.TripPackingResult
import com.fitgpt.app.data.model.UploadResult
import com.fitgpt.app.data.model.WardrobeGapAnalysis
import com.fitgpt.app.data.model.WardrobeGapSuggestion
import com.fitgpt.app.data.model.WeatherSnapshot
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

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

    override suspend fun addItemWithPhoto(item: ClothingItem, photo: UploadImagePayload): ClothingItem {
        val withPhoto = item.copy(imageUrl = "https://example.com/uploads/${photo.fileName}")
        wardrobeItems.add(withPhoto)
        return withPhoto
    }

    override suspend fun addItemsBulk(items: List<ClothingItem>): List<ClothingItem> {
        wardrobeItems.addAll(items)
        return items
    }

    override suspend fun suggestTags(item: ClothingItem): TagSuggestion {
        val suggestedStyle = if (item.category.equals("Outerwear", ignoreCase = true)) {
            listOf("layered")
        } else {
            listOf("casual")
        }
        return TagSuggestion(
            generated = true,
            suggestedClothingType = item.clothingType ?: item.category,
            suggestedFitTag = item.fitTag ?: "regular",
            suggestedColors = item.colors.ifEmpty { listOf(item.color) },
            suggestedSeasonTags = item.seasonTags.ifEmpty { listOf(item.season) },
            suggestedStyleTags = suggestedStyle,
            suggestedOccasionTags = listOf("daily")
        )
    }

    override suspend fun getItemTagSuggestions(itemId: Int): TagSuggestion {
        val item = wardrobeItems.firstOrNull { it.id == itemId } ?: error("item not found")
        return suggestTags(item)
    }

    override suspend fun applyItemTagSuggestions(itemId: Int): ClothingItem {
        val index = wardrobeItems.indexOfFirst { it.id == itemId }
        if (index == -1) error("item not found")
        val current = wardrobeItems[index]
        val suggestion = suggestTags(current)
        val updated = current.copy(
            clothingType = current.clothingType ?: suggestion.suggestedClothingType,
            fitTag = current.fitTag ?: suggestion.suggestedFitTag,
            colors = current.colors.ifEmpty { suggestion.suggestedColors },
            seasonTags = current.seasonTags.ifEmpty { suggestion.suggestedSeasonTags },
            styleTags = current.styleTags.ifEmpty { suggestion.suggestedStyleTags },
            occasionTags = current.occasionTags.ifEmpty { suggestion.suggestedOccasionTags }
        )
        wardrobeItems[index] = updated
        return updated
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

    override suspend fun getWardrobeGaps(): WardrobeGapAnalysis {
        val baseline = linkedMapOf(
            "top" to 2,
            "bottom" to 2,
            "shoes" to 1,
            "outerwear" to 1
        )
        val counts = baseline.keys.associateWith { 0 }.toMutableMap()

        wardrobeItems
            .filter { !it.isArchived }
            .forEach { item ->
                val normalized = item.category.trim().lowercase()
                when {
                    normalized in setOf("top", "tops", "shirt", "t-shirt") -> counts["top"] = (counts["top"] ?: 0) + 1
                    normalized in setOf("bottom", "bottoms", "pants", "jeans", "shorts", "skirt") ->
                        counts["bottom"] = (counts["bottom"] ?: 0) + 1
                    normalized in setOf("shoes", "shoe", "sneakers", "boots", "sandals") ->
                        counts["shoes"] = (counts["shoes"] ?: 0) + 1
                    normalized in setOf("outerwear", "jacket", "coat", "hoodie", "sweater") ->
                        counts["outerwear"] = (counts["outerwear"] ?: 0) + 1
                }
            }

        val missing = baseline.filter { (category, minCount) -> (counts[category] ?: 0) < minCount }.keys.toList()
        return WardrobeGapAnalysis(
            baselineCategories = baseline.keys.toList(),
            categoryCounts = counts,
            missingCategories = missing,
            suggestions = missing.map { category ->
                WardrobeGapSuggestion(
                    category = category,
                    itemName = "Suggested ${category.replaceFirstChar { it.uppercase() }} item",
                    reason = "Wardrobe has fewer $category items than baseline.",
                    imageUrl = null,
                    shoppingLink = "https://www.target.com/s?searchTerm=$category"
                )
            },
            insufficientData = wardrobeItems.count { !it.isArchived } < 3
        )
    }

    override suspend fun getUnderusedAlerts(analysisWindowDays: Int, maxResults: Int): UnderusedAlertsResult {
        val now = System.currentTimeMillis() / 1000
        val alerts = wardrobeItems
            .filter { !it.isArchived }
            .mapNotNull { item ->
                val lastWorn = item.lastWornTimestamp?.div(1000)
                val daysSince = lastWorn?.let { ((now - it) / 86400).toInt().coerceAtLeast(0) }
                if (daysSince == null || daysSince >= analysisWindowDays) {
                    UnderusedAlert(
                        itemId = item.id,
                        itemName = item.name ?: "Item ${item.id}",
                        category = item.category,
                        wearCount = if (lastWorn == null) 0 else 1,
                        lastWornTimestamp = item.lastWornTimestamp,
                        daysSinceWorn = daysSince,
                        alertLevel = if (daysSince == null || daysSince >= analysisWindowDays * 2) "high" else "medium"
                    )
                } else {
                    null
                }
            }
            .take(maxResults)
        return UnderusedAlertsResult(
            generatedAtTimestamp = System.currentTimeMillis(),
            analysisWindowDays = analysisWindowDays,
            alerts = alerts,
            insufficientData = wardrobeItems.count { !it.isArchived } < 3
        )
    }

    override suspend fun getDuplicateCandidates(threshold: Float, limit: Int): List<DuplicateCandidate> {
        val activeItems = wardrobeItems.filter { !it.isArchived }
        val seenPairs = mutableSetOf<String>()
        return activeItems.flatMapIndexed { index, item ->
            activeItems.drop(index + 1).mapNotNull { other ->
                val sameCategory = item.category.equals(other.category, ignoreCase = true)
                val sameColor = item.color.equals(other.color, ignoreCase = true)
                val sameSeason = item.season.equals(other.season, ignoreCase = true)
                val score = listOf(sameCategory, sameColor, sameSeason).count { it } / 3f
                val key = listOf(item.id, other.id).sorted().joinToString(":")
                if (score < threshold || !seenPairs.add(key)) {
                    null
                } else {
                    DuplicateCandidate(
                        item = item,
                        duplicateItem = other,
                        similarityScore = score,
                        reasons = buildList {
                            if (sameCategory) add("same-category")
                            if (sameColor) add("same-color")
                            if (sameSeason) add("same-season")
                        }
                    )
                }
            }
        }.sortedByDescending { it.similarityScore }.take(limit)
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

    override suspend fun rejectRecommendation(itemIds: List<Int>, suggestionId: String?) {
        // In-memory fake repository does not persist rejected combinations.
    }

    override suspend fun recordPromptFeedbackEvent(eventType: String, suggestionId: String?) {
        // No-op in fake repository.
    }

    override suspend fun submitRecommendationFeedback(
        suggestionId: String,
        signal: String,
        itemIds: List<Int>?
    ) {
        // No-op in fake repository; recommendation feedback behavior is verified through backend tests.
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
        val items = getRecommendations(
            manualTemp = manualTemp,
            timeContext = null,
            planDate = null,
            exclude = exclude,
            weatherCity = city,
            weatherLat = null,
            weatherLon = null,
            weatherCategory = weatherCategory,
            occasion = occasion
        )
        return ForecastRecommendationResult(
            items = items,
            explanation = "Forecast planner used the upcoming weather context to keep this outfit practical.",
            outfitScore = 0.76f,
            source = "fake_repository",
            fallbackUsed = false,
            warning = null,
            suggestionId = "forecast-${hoursAhead}-${items.joinToString("-") { it.id.toString() }}",
            forecast = ForecastWeatherContext(
                city = city ?: "Current location",
                forecastTimestamp = System.currentTimeMillis() + (hoursAhead * 60L * 60L * 1000L),
                temperatureF = manualTemp ?: 68,
                weatherCategory = weatherCategory ?: "mild",
                condition = "Partly Cloudy",
                description = "Cooler weather later today",
                windMph = 8f,
                rainMm = 0f,
                snowMm = 0f,
                source = "forecast"
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

    override suspend fun getOutfitHistoryInRange(startDate: String, endDate: String): List<OutfitHistoryEntry> {
        val zoneId = ZoneId.systemDefault()
        val start = LocalDate.parse(startDate)
        val end = LocalDate.parse(endDate)
        return historyEntries.filter { entry ->
            val localDate = Instant.ofEpochMilli(entry.wornAtTimestamp).atZone(zoneId).toLocalDate()
            !localDate.isBefore(start) && !localDate.isAfter(end)
        }
    }

    override suspend fun updateOutfitHistoryEntry(historyId: Long, itemIds: List<Int>?, wornAtTimestamp: Long?) {
        val index = historyEntries.indexOfFirst { it.id == historyId }
        if (index == -1) return
        val existing = historyEntries[index]
        val resolvedItems = itemIds?.let { ids -> wardrobeItems.filter { ids.contains(it.id) } } ?: existing.items
        historyEntries[index] = existing.copy(
            items = resolvedItems,
            wornAtTimestamp = wornAtTimestamp ?: existing.wornAtTimestamp
        )
    }

    override suspend fun deleteOutfitHistoryEntry(historyId: Long) {
        historyEntries.removeAll { it.id == historyId }
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
                items = outfitItems,
                savedAtTimestamp = savedAtTimestamp ?: System.currentTimeMillis()
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

    override suspend fun generateTripPackingList(
        destinationCity: String,
        startDate: String,
        tripDays: Int
    ): TripPackingResult {
        val normalizedDays = tripDays.coerceIn(1, 30)
        val activeItems = wardrobeItems.filter { !it.isArchived && it.isAvailable }
        val tops = activeItems.filter { it.category.equals("Top", true) }
        val bottoms = activeItems.filter { it.category.equals("Bottom", true) }
        val shoes = activeItems.filter { it.category.equals("Shoes", true) }
        val outerwear = activeItems.filter { it.category.equals("Outerwear", true) }
        val items = listOf(
            TripPackingItem(
                category = "top",
                recommendedQuantity = normalizedDays,
                selectedItemIds = tops.take(normalizedDays).map { it.id },
                selectedItemNames = tops.take(normalizedDays).map { it.name ?: "Item ${it.id}" },
                missingQuantity = (normalizedDays - tops.size).coerceAtLeast(0)
            ),
            TripPackingItem(
                category = "bottom",
                recommendedQuantity = maxOf(2, (normalizedDays + 1) / 2),
                selectedItemIds = bottoms.take(maxOf(2, (normalizedDays + 1) / 2)).map { it.id },
                selectedItemNames = bottoms.take(maxOf(2, (normalizedDays + 1) / 2)).map { it.name ?: "Item ${it.id}" },
                missingQuantity = (maxOf(2, (normalizedDays + 1) / 2) - bottoms.size).coerceAtLeast(0)
            ),
            TripPackingItem(
                category = "shoes",
                recommendedQuantity = if (normalizedDays > 4) 2 else 1,
                selectedItemIds = shoes.take(if (normalizedDays > 4) 2 else 1).map { it.id },
                selectedItemNames = shoes.take(if (normalizedDays > 4) 2 else 1).map { it.name ?: "Item ${it.id}" },
                missingQuantity = ((if (normalizedDays > 4) 2 else 1) - shoes.size).coerceAtLeast(0)
            ),
            TripPackingItem(
                category = "outerwear",
                recommendedQuantity = 1,
                selectedItemIds = outerwear.take(1).map { it.id },
                selectedItemNames = outerwear.take(1).map { it.name ?: "Item ${it.id}" },
                missingQuantity = (1 - outerwear.size).coerceAtLeast(0)
            )
        )
        return TripPackingResult(
            destinationCity = destinationCity,
            startDate = startDate,
            tripDays = normalizedDays,
            weatherSummary = "Forecast unavailable (fake repository).",
            items = items,
            generatedAtTimestamp = System.currentTimeMillis(),
            insufficientData = activeItems.size < 3
        )
    }

    override suspend fun getPlannedOutfits(): List<PlannedOutfit> {
        return plannedOutfits.toList()
    }

    override suspend fun removePlannedOutfit(outfitId: Long) {
        plannedOutfits.removeAll { it.id == outfitId }
    }
}
