/**
 * Verifies DTO/domain mapping for remote wardrobe payloads.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.model.ClothingItem
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
}
