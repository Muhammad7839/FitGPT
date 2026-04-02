/**
 * Verifies auth and wardrobe requests stay on one configured backend host.
 */
package com.fitgpt.app.data.network

import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class BackendOriginPinningFlowTest {

    private lateinit var server: MockWebServer
    private lateinit var api: ApiService
    private lateinit var pinnedHost: String
    private var pinnedPort: Int = -1

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()

        val baseUrl = server.url("/")
        pinnedHost = baseUrl.host
        pinnedPort = baseUrl.port
        BackendEndpointRegistry.initialize(baseUrl.toString())

        val client = OkHttpClient.Builder()
            .addInterceptor(BackendFailoverInterceptor())
            .build()

        api = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loginMeWardrobeCreateAndFetchStayOnPinnedHost() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody("""{"access_token":"jwt-token","token_type":"bearer"}""")
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "id": 101,
                      "email": "user@example.com",
                      "avatar_url": null,
                      "body_type": "unspecified",
                      "lifestyle": "casual",
                      "comfort_preference": "medium",
                      "onboarding_complete": false
                    }
                    """.trimIndent()
                )
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody(clothingItemJson(id = 501))
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody("[${clothingItemJson(id = 501)}]")
        )

        api.login(email = "user@example.com", password = "password123")
        api.getCurrentUser()
        api.addWardrobeItem(
            payload = ClothingItemCreateRequest(
                name = "Black Tee",
                category = "Top",
                clothingType = "t-shirt",
                fitTag = "regular",
                color = "Black",
                season = "All",
                comfortLevel = 3,
                imageUrl = null,
                brand = null,
                isAvailable = true,
                isFavorite = false,
                isArchived = false,
                lastWornTimestamp = null,
            )
        )
        api.getWardrobeItems()

        val first = server.takeRequest()
        val second = server.takeRequest()
        val third = server.takeRequest()
        val fourth = server.takeRequest()

        assertEquals("/login", first.path)
        assertEquals("/me", second.path)
        assertEquals("/wardrobe/items", third.path)
        assertTrue((fourth.path ?: "").startsWith("/wardrobe/items"))

        val requests = listOf(first, second, third, fourth)
        requests.forEach { request ->
            val requestUrl = request.requestUrl
            assertEquals(pinnedHost, requestUrl?.host)
            assertEquals(pinnedPort, requestUrl?.port)
        }
    }

    private fun clothingItemJson(id: Int): String {
        return """
            {
              "id": $id,
              "name": "Black Tee",
              "category": "Top",
              "clothing_type": "t-shirt",
              "fit_tag": "regular",
              "color": "Black",
              "colors": ["Black"],
              "season": "All",
              "season_tags": ["All"],
              "style_tags": [],
              "occasion_tags": [],
              "comfort_level": 3,
              "image_url": null,
              "brand": null,
              "is_available": true,
              "is_favorite": false,
              "is_archived": false,
              "last_worn_timestamp": null
            }
        """.trimIndent()
    }
}
