/**
 * Verifies Android wardrobe photos stay local while item metadata still syncs remotely.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.data.network.BackendEndpointRegistry
import com.fitgpt.app.data.remote.ApiService
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class RemoteWardrobeRepositoryLocalImagesTest {
    private lateinit var server: MockWebServer
    private lateinit var repository: RemoteWardrobeRepository
    private lateinit var imageStore: MemoryWardrobeImageStore

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        BackendEndpointRegistry.initialize(server.url("/").toString())

        val api = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)

        imageStore = MemoryWardrobeImageStore()
        repository = RemoteWardrobeRepository(api = api, imageStore = imageStore)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun addItemWithPhotoSyncsMetadataOnlyAndReturnsLocalImage() = runBlocking {
        server.enqueue(jsonResponse(clothingItemJson(id = 77, imageUrl = "/uploads/dead.jpg")))

        val created = repository.addItemWithPhoto(
            item = item(id = 1),
            photo = UploadImagePayload(
                bytes = byteArrayOf(1, 2, 3),
                fileName = "jacket.jpg",
                mimeType = "image/jpeg"
            )
        )

        val request = server.takeRequest()
        assertEquals("/wardrobe/items", request.path)
        assertFalse(request.body.readUtf8().contains("image_url"))
        assertEquals("file:///wardrobe/77/jacket.jpg", created.imageUrl)
    }

    @Test
    fun fetchedWardrobePrefersLocalImageOverRemoteUploadPath() = runBlocking {
        imageStore.imagesByItemId[77] = "file:///wardrobe/77/local.jpg"
        server.enqueue(jsonResponse("[${clothingItemJson(id = 77, imageUrl = "/uploads/dead.jpg")}]"))

        val items = repository.getWardrobeItems()

        assertEquals("file:///wardrobe/77/local.jpg", items.single().imageUrl)
    }

    private fun item(id: Int): ClothingItem {
        return ClothingItem(
            id = id,
            name = "Black Jacket",
            category = "Outerwear",
            clothingType = "jacket",
            fitTag = "regular",
            color = "Black",
            colors = listOf("Black"),
            season = "All",
            seasonTags = listOf("All"),
            comfortLevel = 3,
            imageUrl = "file:///temp/jacket.jpg"
        )
    }

    private fun jsonResponse(body: String): MockResponse {
        return MockResponse()
            .setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }

    private fun clothingItemJson(id: Int, imageUrl: String?): String {
        val imageValue = imageUrl?.let { "\"$it\"" } ?: "null"
        return """
            {
              "id": $id,
              "name": "Black Jacket",
              "category": "Outerwear",
              "clothing_type": "jacket",
              "fit_tag": "regular",
              "color": "Black",
              "colors": ["Black"],
              "season": "All",
              "season_tags": ["All"],
              "style_tags": [],
              "occasion_tags": [],
              "suggested_colors": [],
              "suggested_season_tags": [],
              "suggested_style_tags": [],
              "suggested_occasion_tags": [],
              "comfort_level": 3,
              "image_url": $imageValue,
              "brand": null,
              "is_available": true,
              "is_favorite": false,
              "is_archived": false,
              "last_worn_timestamp": null
            }
        """.trimIndent()
    }

    private class MemoryWardrobeImageStore : WardrobeImageStore {
        val imagesByItemId = mutableMapOf<Int, String>()

        override fun saveTemporaryImage(bytes: ByteArray, fileName: String): String {
            return "file:///temp/$fileName"
        }

        override fun saveImageForItem(itemId: Int, bytes: ByteArray, fileName: String): String {
            return "file:///wardrobe/$itemId/$fileName".also {
                imagesByItemId[itemId] = it
            }
        }

        override fun attachExistingImageToItem(itemId: Int, imageUrl: String?): String? {
            return imageUrl?.replace("/temp/", "/wardrobe/$itemId/")?.also {
                imagesByItemId[itemId] = it
            }
        }

        override fun localImageUrlForItem(itemId: Int): String? = imagesByItemId[itemId]

        override fun deleteImageForItem(itemId: Int) {
            imagesByItemId.remove(itemId)
        }
    }
}
