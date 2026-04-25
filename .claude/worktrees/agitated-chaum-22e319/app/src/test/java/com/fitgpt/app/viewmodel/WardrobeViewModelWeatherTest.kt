package com.fitgpt.app.viewmodel

import com.fitgpt.app.data.model.WeatherSnapshot
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
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class WardrobeViewModelWeatherTest {

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
    fun fetchWeather_locationCoordinatesButProviderUnavailable_setsExplicitStatus() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                error("weather provider down")
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(
            lat = 37.4,
            lon = -122.1,
            source = WeatherRequestSource.LOCATION
        )
        advanceUntilIdle()

        assertEquals(
            WeatherStatusType.LOCATION_READY_WEATHER_UNAVAILABLE,
            viewModel.weatherUiStatus.value.type
        )
        assertTrue(viewModel.weatherState.value is UiState.Success)
    }

    @Test
    fun fetchWeather_locationSuccess_updatesCityAndAvailableState() = runTest {
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                assertEquals("Mountain View", city)
                assertNull(lat)
                assertNull(lon)
                return WeatherSnapshot(
                    city = "Mountain View",
                    temperatureF = 67,
                    weatherCategory = "mild",
                    condition = "Clear",
                    description = "Clear sky",
                    available = true
                )
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(
            city = "Mountain View",
            source = WeatherRequestSource.LOCATION
        )
        advanceUntilIdle()

        assertEquals(WeatherStatusType.AVAILABLE, viewModel.weatherUiStatus.value.type)
        val state = viewModel.weatherState.value as UiState.Success
        assertEquals("Mountain View", state.data?.city)
        assertEquals("Mountain View", viewModel.getCachedWeatherCity())
    }

    @Test
    fun fetchWeather_afterSuccessfulSnapshot_failureFallsBackToStaleWeather() = runTest {
        var succeed = true
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                if (!succeed) {
                    error("weather provider down")
                }
                return WeatherSnapshot(
                    city = "Mountain View",
                    temperatureF = 68,
                    weatherCategory = "mild",
                    condition = "Clear",
                    description = "Clear sky",
                    available = true
                )
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(city = "Mountain View", source = WeatherRequestSource.MANUAL_CITY)
        advanceUntilIdle()
        assertEquals(WeatherStatusType.AVAILABLE, viewModel.weatherUiStatus.value.type)

        succeed = false
        viewModel.fetchWeather(city = "Mountain View", source = WeatherRequestSource.MANUAL_CITY)
        advanceUntilIdle()

        assertEquals(WeatherStatusType.STALE_WEATHER, viewModel.weatherUiStatus.value.type)
        val state = viewModel.weatherState.value as UiState.Success
        assertEquals("Mountain View", state.data?.city)
    }

    @Test
    fun fetchWeather_retryAfterProviderFailure_recoversToAvailable() = runTest {
        var attempts = 0
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                attempts += 1
                if (attempts == 1) {
                    error("temporary weather outage")
                }
                return WeatherSnapshot(
                    city = "Mountain View",
                    temperatureF = 72,
                    weatherCategory = "warm",
                    condition = "Sunny",
                    description = "Sunny",
                    available = true
                )
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(
            lat = 37.4,
            lon = -122.1,
            source = WeatherRequestSource.LOCATION
        )
        advanceUntilIdle()
        assertEquals(
            WeatherStatusType.LOCATION_READY_WEATHER_UNAVAILABLE,
            viewModel.weatherUiStatus.value.type
        )

        viewModel.fetchWeather(
            lat = 37.4,
            lon = -122.1,
            source = WeatherRequestSource.LOCATION
        )
        advanceUntilIdle()

        assertEquals(WeatherStatusType.AVAILABLE, viewModel.weatherUiStatus.value.type)
        val state = viewModel.weatherState.value as UiState.Success
        assertEquals("Mountain View", state.data?.city)
    }

    @Test
    fun retryWeather_usesLastSuccessfulCityWhenNoRequestIsActive() = runTest {
        var requestedCity: String? = null
        var requestedLat: Double? = null
        var requestedLon: Double? = null
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                requestedCity = city
                requestedLat = lat
                requestedLon = lon
                return WeatherSnapshot(
                    city = city ?: "Mountain View",
                    temperatureF = 70,
                    weatherCategory = "mild",
                    condition = "Clear",
                    description = "Clear sky",
                    available = true
                )
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(city = "Mountain View", source = WeatherRequestSource.MANUAL_CITY)
        advanceUntilIdle()
        viewModel.setWeatherCityInput("")

        requestedCity = null
        viewModel.retryWeather()
        advanceUntilIdle()

        assertEquals("Mountain View", requestedCity)
        assertEquals(WeatherStatusType.AVAILABLE, viewModel.weatherUiStatus.value.type)
    }

    @Test
    fun fetchWeather_withFreshCoordinates_doesNotReuseCachedCity() = runTest {
        var requestedCity: String? = null
        var requestedLat: Double? = null
        var requestedLon: Double? = null
        val repo = object : WardrobeRepository by FakeWardrobeRepository() {
            override suspend fun getCurrentWeather(city: String?, lat: Double?, lon: Double?): WeatherSnapshot {
                requestedCity = city
                requestedLat = lat
                requestedLon = lon
                return WeatherSnapshot(
                    city = "New York",
                    temperatureF = 61,
                    weatherCategory = "mild",
                    condition = "Cloudy",
                    description = "Cloudy",
                    available = true
                )
            }
        }
        val viewModel = WardrobeViewModel(repo)

        viewModel.fetchWeather(city = "Mountain View", source = WeatherRequestSource.MANUAL_CITY)
        advanceUntilIdle()

        viewModel.fetchWeather(
            lat = 40.7128,
            lon = -74.0060,
            source = WeatherRequestSource.LOCATION
        )
        advanceUntilIdle()

        assertNull(requestedCity)
        assertEquals(40.7128, requestedLat ?: 0.0, 0.0001)
        assertEquals(-74.0060, requestedLon ?: 0.0, 0.0001)
        assertEquals("New York", viewModel.getCachedWeatherCity())
    }

    @Test
    fun markWeatherPermissionNeeded_setsPermissionStatus() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())

        viewModel.markWeatherPermissionNeeded()

        assertEquals(WeatherStatusType.PERMISSION_NEEDED, viewModel.weatherUiStatus.value.type)
    }

    @Test
    fun markWeatherManualFallback_setsManualFallbackStatus() = runTest {
        val viewModel = WardrobeViewModel(FakeWardrobeRepository())

        viewModel.markWeatherManualFallback()

        assertEquals(WeatherStatusType.MANUAL_CITY_FALLBACK, viewModel.weatherUiStatus.value.type)
    }
}
