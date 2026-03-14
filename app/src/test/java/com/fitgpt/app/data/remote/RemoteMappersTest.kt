/**
 * Mapper tests for additive metadata fields and AI outfit options.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.remote.dto.AiRecommendationItemExplanationDto
import com.fitgpt.app.data.remote.dto.AiRecommendationResponseDto
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.OutfitOptionDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteMappersTest {

    @Test
    fun clothingItem_toCreateRequest_keeps_new_metadata_fields() {
        val item = ClothingItem(
            id = 1,
            name = "Office Blazer",
            category = "Outerwear",
            clothingType = "blazer",
            layerType = "outer",
            isOnePiece = false,
            setIdentifier = "set-1",
            fitTag = "regular",
            color = "Navy",
            colors = listOf("Navy", "White"),
            season = "Fall",
            seasonTags = listOf("fall", "winter"),
            styleTags = listOf("formal"),
            occasionTags = listOf("work"),
            accessoryType = null,
            comfortLevel = 3
        )

        val request = item.toCreateRequest()
        assertEquals("outer", request.layerType)
        assertFalse(request.isOnePiece)
        assertEquals("set-1", request.setIdentifier)
        assertEquals(listOf("Navy", "White"), request.colors)
        assertEquals(listOf("fall", "winter"), request.seasonTags)
        assertEquals(listOf("formal"), request.styleTags)
        assertEquals(listOf("work"), request.occasionTags)
    }

    @Test
    fun aiRecommendationDto_toDomain_maps_scores_and_options() {
        val dtoItem = ClothingItemDto(
            id = 10,
            name = "Top",
            category = "Top",
            clothingType = "shirt",
            layerType = "base",
            isOnePiece = false,
            setIdentifier = null,
            fitTag = "regular",
            color = "Black",
            colors = listOf("Black"),
            season = "All",
            seasonTags = listOf("all"),
            styleTags = listOf("casual"),
            occasionTags = listOf("daily"),
            accessoryType = null,
            comfortLevel = 3,
            imageUrl = null,
            brand = null,
            isAvailable = true,
            isFavorite = false,
            isArchived = false,
            lastWornTimestamp = null
        )
        val response = AiRecommendationResponseDto(
            items = listOf(dtoItem),
            explanation = "Balanced look",
            outfitScore = 0.91f,
            weatherCategory = "mild",
            occasion = "daily",
            source = "ai",
            fallbackUsed = false,
            warning = null,
            suggestionId = "10",
            itemExplanations = listOf(
                AiRecommendationItemExplanationDto(
                    itemId = 10,
                    explanation = "Strong base layer"
                )
            ),
            outfitOptions = listOf(
                OutfitOptionDto(
                    items = listOf(dtoItem),
                    explanation = "Option one",
                    outfitScore = 0.88f
                )
            )
        )

        val mapped = response.toDomain()
        assertEquals(0.91f, mapped.outfitScore)
        assertEquals(1, mapped.outfitOptions.size)
        assertEquals(0.88f, mapped.outfitOptions.first().outfitScore)
        assertEquals("Option one", mapped.outfitOptions.first().explanation)
        assertTrue(mapped.itemExplanations.containsKey(10))
    }
}
