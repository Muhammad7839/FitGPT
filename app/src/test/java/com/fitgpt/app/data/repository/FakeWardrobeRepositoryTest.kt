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
    }

    @Test
    fun recommendations_returnTopBottomShoesWhenAvailable() = runTest {
        val repo = FakeWardrobeRepository()
        repo.addItem(
            ClothingItem(
                id = 3,
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
}
