/**
 * Verifies DTO/domain mapping for remote wardrobe payloads.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.remote.dto.AiRecommendationItemExplanationDto
import com.fitgpt.app.data.remote.dto.AiRecommendationResponseDto
import com.fitgpt.app.data.remote.dto.ChatResponseDto
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteMappersTest {

    @Test
    fun dtoToDomain_mapsAllFields() {
        val dto = ClothingItemDto(
            id = 5,
            name = "Oxford Shirt",
            category = "Top",
            clothingType = "shirt",
            fitTag = "regular",
            color = "Black",
            season = "Winter",
            comfortLevel = 4,
            imageUrl = "https://example.com/item.png",
            brand = "Uniqlo",
            isAvailable = true,
            isFavorite = true,
            isArchived = false,
            lastWornTimestamp = 12345L
        )

        val model = dto.toDomain()

        assertEquals(5, model.id)
        assertEquals("Oxford Shirt", model.name)
        assertEquals("Top", model.category)
        assertEquals("shirt", model.clothingType)
        assertEquals("regular", model.fitTag)
        assertEquals("Black", model.color)
        assertEquals("Winter", model.season)
        assertEquals(4, model.comfortLevel)
        assertEquals("Uniqlo", model.brand)
        assertEquals(12345L, model.lastWornTimestamp)
        assertTrue(model.isAvailable)
        assertTrue(model.isFavorite)
    }

    @Test
    fun domainToCreateRequest_mapsAllFields() {
        val model = ClothingItem(
            id = 9,
            name = "Classic Chino",
            category = "Bottom",
            clothingType = "pants",
            fitTag = "slim",
            color = "Blue",
            season = "All",
            comfortLevel = 3,
            imageUrl = null,
            brand = "Levi's",
            isAvailable = true,
            isFavorite = true,
            isArchived = false,
            lastWornTimestamp = null
        )

        val request = model.toCreateRequest()
        assertEquals("Classic Chino", request.name)
        assertEquals("Bottom", request.category)
        assertEquals("pants", request.clothingType)
        assertEquals("slim", request.fitTag)
        assertEquals("Blue", request.color)
        assertEquals(3, request.comfortLevel)
        assertEquals("Levi's", request.brand)
        assertTrue(request.isFavorite)
    }

    @Test
    fun aiRecommendationDtoToDomain_mapsMetadata() {
        val response = AiRecommendationResponseDto(
            items = listOf(
                ClothingItemDto(
                    id = 3,
                    name = "Black Tee",
                    category = "Top",
                    clothingType = "tee",
                    fitTag = null,
                    color = "Black",
                    season = "All",
                    comfortLevel = 4,
                    imageUrl = null,
                    brand = null,
                    isAvailable = true,
                    isFavorite = false,
                    isArchived = false,
                    lastWornTimestamp = null
                )
            ),
            explanation = "Balanced outfit.",
            weatherCategory = "mild",
            occasion = "office",
            source = "ai",
            fallbackUsed = false,
            warning = null,
            suggestionId = "3,4,5",
            itemExplanations = listOf(
                AiRecommendationItemExplanationDto(
                    itemId = 3,
                    explanation = "Neutral base."
                )
            )
        )

        val model = response.toDomain()
        assertEquals("ai", model.source)
        assertEquals("Balanced outfit.", model.explanation)
        assertEquals("mild", model.weatherCategory)
        assertEquals("office", model.occasion)
        assertEquals("3,4,5", model.suggestionId)
        assertEquals("Neutral base.", model.itemExplanations[3])
    }

    @Test
    fun chatResponseDtoToDomain_mapsFallbackFields() {
        val dto = ChatResponseDto(
            reply = "Try a lighter top.",
            source = "fallback",
            fallbackUsed = true,
            warning = "provider_timeout"
        )

        val model = dto.toDomain()
        assertEquals("Try a lighter top.", model.reply)
        assertEquals("fallback", model.source)
        assertTrue(model.fallbackUsed)
        assertEquals("provider_timeout", model.warning)
    }
}
