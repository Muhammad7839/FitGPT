package com.fitgpt.app.viewmodel

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.repository.FakeWardrobeRepository
import com.fitgpt.app.data.repository.WardrobeRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class WardrobeViewModelMutationTest {

    class MainDispatcherRule(
        private val dispatcher: TestDispatcher = UnconfinedTestDispatcher()
    ) : TestWatcher() {
        override fun starting(description: Description) {
            Dispatchers.setMain(dispatcher)
        }

        override fun finished(description: Description) {
            Dispatchers.resetMain()
        }
    }

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun initialWardrobeLoad_excludesArchivedItemsByDefault() = runTest {
        val includeArchivedValues = mutableListOf<Boolean>()
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
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
                includeArchivedValues += includeArchived
                return emptyList()
            }
        }

        WardrobeViewModel(repo)
        advanceUntilIdle()

        assertEquals(listOf(false), includeArchivedValues)
    }

    @Test
    fun applyWardrobeFilters_sameFilters_doesNotTriggerSecondLoad() = runTest {
        val includeArchivedValues = mutableListOf<Boolean>()
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
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
                includeArchivedValues += includeArchived
                return emptyList()
            }
        }
        val viewModel = WardrobeViewModel(repo)
        advanceUntilIdle()

        viewModel.applyWardrobeFilters(WardrobeFilters())
        advanceUntilIdle()

        assertEquals(listOf(false), includeArchivedValues)
    }

    @Test
    fun addItem_updatesWardrobeStateWithSavedItem() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())
        advanceUntilIdle()

        viewModel.addItem(
            ClothingItem(
                id = 99,
                name = "Oxford Shirt",
                category = "Top",
                color = "Blue",
                season = "All",
                comfortLevel = 4
            )
        )
        advanceUntilIdle()

        val state = viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>
        assertTrue(state.data.any { it.id == 99 && it.name == "Oxford Shirt" })
    }

    @Test
    fun updateItem_refreshesWardrobeState() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())
        advanceUntilIdle()

        val existing = (viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>).data.first()
        viewModel.updateItem(existing.copy(color = "Ivory"))
        advanceUntilIdle()

        val state = viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>
        assertEquals("Ivory", state.data.first { it.id == existing.id }.color)
    }

    @Test
    fun deleteAndFavoriteMutations_refreshSharedWardrobeState() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())
        advanceUntilIdle()

        val existing = (viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>).data.first()
        viewModel.toggleFavorite(existing.id)
        advanceUntilIdle()

        var state = viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>
        assertTrue(state.data.first { it.id == existing.id }.isFavorite)

        viewModel.deleteItem(existing)
        advanceUntilIdle()

        state = viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>
        assertFalse(state.data.any { it.id == existing.id && !it.isArchived })
    }

    @Test
    fun markOutfitAsWorn_success_setsDedicatedMutationState() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())
        advanceUntilIdle()

        val items = (viewModel.wardrobeState.value as UiState.Success<List<ClothingItem>>).data
        viewModel.markOutfitAsWorn(items)
        advanceUntilIdle()

        assertEquals(UiState.Success(true), viewModel.wearOutfitState.value)
    }

    @Test
    fun markOutfitAsWorn_failure_setsDedicatedMutationError() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun markOutfitAsWorn(items: List<ClothingItem>, wornAtTimestamp: Long) {
                error("history update failed")
            }
        }
        val viewModel = WardrobeViewModel(repo)
        advanceUntilIdle()

        val items = listOf(
            ClothingItem(
                id = 10,
                name = "Look",
                category = "Top",
                color = "Black",
                season = "All",
                comfortLevel = 3
            )
        )
        viewModel.markOutfitAsWorn(items)
        advanceUntilIdle()

        assertEquals(
            UiState.Error("Failed to update wear history"),
            viewModel.wearOutfitState.value
        )
    }

    @Test
    fun planCurrentRecommendation_success_setsDedicatedMutationState() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())
        advanceUntilIdle()

        viewModel.fetchRecommendations()
        advanceUntilIdle()
        viewModel.planCurrentRecommendation("2026-04-17", "Planned from recommendation")
        advanceUntilIdle()

        assertEquals(UiState.Success(true), viewModel.planRecommendationState.value)
    }

    @Test
    fun planCurrentRecommendation_failure_setsDedicatedMutationError() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun planOutfit(itemIds: List<Int>, planDate: String, occasion: String) {
                error("plan failed")
            }
        }
        val viewModel = WardrobeViewModel(repo)
        advanceUntilIdle()

        viewModel.fetchRecommendations()
        advanceUntilIdle()
        viewModel.planCurrentRecommendation("2026-04-17", "Planned from recommendation")
        advanceUntilIdle()

        assertEquals(
            UiState.Error("Failed to plan outfit"),
            viewModel.planRecommendationState.value
        )
    }

    @Test
    fun fetchRecommendations_fallsBackToLegacyEndpointWhenAiRequestFails() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
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
            ) = error("ai unavailable")
        }
        val viewModel = WardrobeViewModel(repo)
        advanceUntilIdle()

        viewModel.fetchRecommendations()
        advanceUntilIdle()

        assertTrue(viewModel.recommendationState.value is UiState.Success)
        assertTrue(viewModel.recommendationMeta.value.fallbackUsed)
        assertEquals("legacy_endpoint_fallback", viewModel.recommendationMeta.value.warning)
    }

    @Test
    fun fetchRecommendations_setsErrorWhenAiAndLegacyEndpointsFail() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
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
            ) = error("ai unavailable")

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
            ): List<ClothingItem> = error("legacy unavailable")
        }
        val viewModel = WardrobeViewModel(repo)
        advanceUntilIdle()

        viewModel.fetchRecommendations()
        advanceUntilIdle()

        assertEquals(
            UiState.Error("Failed to load recommendations"),
            viewModel.recommendationState.value
        )
    }
}
