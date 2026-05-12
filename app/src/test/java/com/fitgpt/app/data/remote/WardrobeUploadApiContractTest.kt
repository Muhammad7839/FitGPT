/**
 * Locks Android wardrobe upload requests to the FastAPI multipart contract.
 */
package com.fitgpt.app.data.remote

import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class WardrobeUploadApiContractTest {
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
    fun uploadWardrobeImagePostsMultipartImagePartToExpectedEndpoint() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody("""{"image_url":"/uploads/item_123.jpg"}""")
        )

        val part = MultipartBody.Part.createFormData(
            name = "image",
            filename = "item.jpg",
            body = "jpeg-data".toRequestBody("image/jpeg".toMediaType())
        )

        val response = api.uploadWardrobeImage(part)

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/wardrobe/items/image", request.path)
        assertTrue(request.getHeader("Content-Type").orEmpty().startsWith("multipart/form-data"))
        val body = request.body.readUtf8()
        assertTrue(body.contains("name=\"image\""))
        assertTrue(body.contains("filename=\"item.jpg\""))
        assertEquals("/uploads/item_123.jpg", response.imageUrl)
    }

    @Test
    fun uploadWardrobeImagesPostsRepeatedImagesPartsToBatchEndpoint() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {
                      "results": [
                        {"file_name":"a.jpg","status":"success","image_url":"/uploads/a.jpg","error":null},
                        {"file_name":"b.jpg","status":"success","image_url":"/uploads/b.jpg","error":null}
                      ]
                    }
                    """.trimIndent()
                )
        )

        val parts = listOf(
            MultipartBody.Part.createFormData(
                name = "images",
                filename = "a.jpg",
                body = "a-data".toRequestBody("image/jpeg".toMediaType())
            ),
            MultipartBody.Part.createFormData(
                name = "images",
                filename = "b.jpg",
                body = "b-data".toRequestBody("image/jpeg".toMediaType())
            )
        )

        val response = api.uploadWardrobeImages(parts)

        val request = server.takeRequest()
        assertEquals("POST", request.method)
        assertEquals("/wardrobe/items/images", request.path)
        val body = request.body.readUtf8()
        assertTrue(body.contains("name=\"images\""))
        assertTrue(body.contains("filename=\"a.jpg\""))
        assertTrue(body.contains("filename=\"b.jpg\""))
        assertEquals(2, response.results.size)
        assertEquals("/uploads/a.jpg", response.results[0].imageUrl)
        assertEquals("/uploads/b.jpg", response.results[1].imageUrl)
    }
}
