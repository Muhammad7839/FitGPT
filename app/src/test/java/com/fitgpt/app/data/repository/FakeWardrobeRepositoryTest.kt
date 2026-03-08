/**
 * Covers in-memory repository behavior used by local tests.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeWardrobeRepositoryTest {

    @Test
    fun addUpdateDeleteItem_flowWorks() = runTest {
        val repo = FakeWardrobeRepository()
        val item = ClothingItem(
            id = 99,
            name = "Running Shoe",
            category = "Shoes",
            color = "White",
            season = "All",
            comfortLevel = 2
        )

        repo.addItem(item)
        var items = repo.getWardrobeItems()
        assertTrue(items.any { it.id == 99 })

        repo.updateItem(item.copy(color = "Black"))
        items = repo.getWardrobeItems()
        assertEquals("Black", items.first { it.id == 99 }.color)

        repo.deleteItem(item)
        items = repo.getWardrobeItems()
        assertTrue(items.none { it.id == 99 })

        val withArchived = repo.getWardrobeItems(includeArchived = true)
        assertTrue(withArchived.any { it.id == 99 && it.isArchived })
    }

    @Test
    fun recommendations_returnTopBottomShoesWhenAvailable() = runTest {
        val repo = FakeWardrobeRepository()
        repo.addItem(
            ClothingItem(
                id = 3,
                name = "Daily Sneaker",
                category = "Shoes",
                color = "White",
                season = "All",
                comfortLevel = 4
            )
        )

        val recs = repo.getRecommendations()
        val categories = recs.map { it.category.lowercase() }.toSet()
        assertTrue(categories.contains("top"))
        assertTrue(categories.contains("bottom"))
        assertTrue(categories.contains("shoes"))
    }

    @Test
    fun assignOutfitToDates_replacesEntriesWhenRequested() = runTest {
        val repo = FakeWardrobeRepository()
        val itemIds = repo.getWardrobeItems().map { it.id }

        repo.assignOutfitToDates(
            itemIds = itemIds,
            plannedDates = listOf("2026-05-01"),
            occasion = "Work",
            replaceExisting = true
        )
        repo.assignOutfitToDates(
            itemIds = itemIds.take(1),
            plannedDates = listOf("2026-05-01"),
            occasion = "Gym",
            replaceExisting = true
        )

        val plans = repo.getPlannedOutfits().filter { it.planDate == "2026-05-01" }
        assertEquals(1, plans.size)
        assertEquals("Gym", plans.first().occasion)
    }
}
