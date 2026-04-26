/**
 * Locks Android auth requests to the FastAPI backend contract.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.remote.dto.RegisterRequest
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class AuthApiContractTest {
    private lateinit var server: MockWebServer
    private lateinit var api: ApiService

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        api = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun registerPostsBackendExpectedJsonToRegisterEndpoint() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "id": 42,
                      "email": "user@example.com",
                      "avatar_url": null,
                      "body_type": "unspecified",
                      "lifestyle": "casual",
                      "comfort_preference": "medium",
                      "style_preferences": [],
                      "comfort_preferences": [],
                      "dress_for": [],
                      "gender": null,
                      "height_cm": null,
                      "onboarding_complete": false
                    }
                    """.trimIndent()
                )
        )

        api.register(RegisterRequest(email = "user@example.com", password = "Fitgpt2026"))

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/register", request.path)
        assertEquals(
            """{"email":"user@example.com","password":"Fitgpt2026"}""",
            request.body.readUtf8()
        )
    }

    @Test
    fun loginPostsFormCredentialsToLoginEndpointAndParsesAccessToken() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody("""{"access_token":"jwt-token","token_type":"bearer"}""")
        )

        val response = api.login(email = "user@example.com", password = "Fitgpt2026")

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/login", request.path)
        assertTrue(request.getHeader("Content-Type").orEmpty().startsWith("application/x-www-form-urlencoded"))
        assertEquals("username=user%40example.com&password=Fitgpt2026", request.body.readUtf8())
        assertEquals("jwt-token", response.accessToken)
        assertEquals("bearer", response.tokenType)
    }
}
