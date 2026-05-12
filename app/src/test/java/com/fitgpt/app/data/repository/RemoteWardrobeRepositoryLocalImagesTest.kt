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
import org.junit.Assert.assertTrue
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
        server.enqueue(jsonResponse("""{"image_url":"/uploads/jacket.jpg"}"""))
        server.enqueue(jsonResponse(clothingItemJson(id = 77, imageUrl = "/uploads/dead.jpg")))

        val created = repository.addItemWithPhoto(
            item = item(id = 1),
            photo = UploadImagePayload(
                bytes = byteArrayOf(1, 2, 3),
                fileName = "jacket.jpg",
                mimeType = "image/jpeg"
            )
        )

        val uploadRequest = server.takeRequest()
        assertEquals("/wardrobe/items/image", uploadRequest.path)

        val createRequest = server.takeRequest()
        assertEquals("/wardrobe/items", createRequest.path)
        assertTrue(createRequest.body.readUtf8().contains("image_url"))
        assertEquals("file:///wardrobe/77/jacket.jpg", created.imageUrl)
    }

    @Test
    fun fetchedWardrobePrefersLocalImageOverRemoteUploadPath() = runBlocking {
        imageStore.imagesByItemId[77] = "file:///wardrobe/77/local.jpg"
        server.enqueue(jsonResponse(wardrobeItemsResponseJson(clothingItemJson(id = 77, imageUrl = "/uploads/dead.jpg"))))

        val items = repository.getWardrobeItems()

        assertEquals("file:///wardrobe/77/local.jpg", items.single().imageUrl)
    }

    @Test
    fun bulkCreateAttachesUploadedLocalImagesToSavedItems() = runBlocking {
        server.enqueue(
            jsonResponse(
                """
                {
                  "results": [
                    {
                      "index": 0,
                      "status": "success",
                      "item": ${clothingItemJson(id = 101, imageUrl = "/uploads/remote-a.jpg")},
                      "error": null
                    },
                    {
                      "index": 1,
                      "status": "success",
                      "item": ${clothingItemJson(id = 102, imageUrl = "/uploads/remote-b.jpg")},
                      "error": null
                    }
                  ]
                }
                """.trimIndent()
            )
        )

        val created = repository.addItemsBulk(
            listOf(
                item(id = 1).copy(name = "Item A", imageUrl = "file:///temp/a.jpg"),
                item(id = 2).copy(name = "Item B", imageUrl = "file:///temp/b.jpg")
            )
        )

        val request = server.takeRequest()
        assertEquals("/wardrobe/items/bulk", request.path)
        assertEquals("file:///wardrobe/101/a.jpg", created[0].imageUrl)
        assertEquals("file:///wardrobe/102/b.jpg", created[1].imageUrl)
    }

    @Test
    fun uploadImageResolvesRelativeBackendPathsToAbsoluteUrls() = runBlocking {
        server.enqueue(jsonResponse("""{"image_url":"/uploads/item_123.jpg"}"""))

        val uploadedUrl = repository.uploadImage(
            bytes = byteArrayOf(1, 2, 3),
            fileName = "item.jpg",
            mimeType = "image/jpeg"
        )

        val request = server.takeRequest()
        assertEquals("/wardrobe/items/image", request.path)
        assertEquals("file:///temp/item.jpg", uploadedUrl)
    }

    @Test
    fun uploadImagesBatchReturnsLocalPreviewUrlsWhileCachingRemoteUrlsForPersistence() = runBlocking {
        server.enqueue(
            jsonResponse(
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
        server.enqueue(
            jsonResponse(
                """
                {
                  "results": [
                    {
                      "index": 0,
                      "status": "success",
                      "item": ${clothingItemJson(id = 201, imageUrl = "${server.url("/")}uploads/a.jpg")},
                      "error": null
                    },
                    {
                      "index": 1,
                      "status": "success",
                      "item": ${clothingItemJson(id = 202, imageUrl = "${server.url("/")}uploads/b.jpg")},
                      "error": null
                    }
                  ]
                }
                """.trimIndent()
            )
        )

        val uploaded = repository.uploadImagesBatch(
            listOf(
                UploadImagePayload(byteArrayOf(1, 2, 3), "a.jpg", "image/jpeg"),
                UploadImagePayload(byteArrayOf(4, 5, 6), "b.jpg", "image/jpeg")
            )
        )
        assertEquals("file:///temp/a.jpg", uploaded[0].imageUrl)
        assertEquals("file:///temp/b.jpg", uploaded[1].imageUrl)

        val created = repository.addItemsBulk(
            listOf(
                item(id = 1).copy(name = "Item A", imageUrl = uploaded[0].imageUrl),
                item(id = 2).copy(name = "Item B", imageUrl = uploaded[1].imageUrl)
            )
        )

        val batchUploadRequest = server.takeRequest()
        assertEquals("/wardrobe/items/images", batchUploadRequest.path)

        val createRequest = server.takeRequest()
        assertEquals("/wardrobe/items/bulk", createRequest.path)
        val body = createRequest.body.readUtf8()
        assertTrue(body.contains("${server.url("/")}uploads/a.jpg"))
        assertTrue(body.contains("${server.url("/")}uploads/b.jpg"))
        assertEquals("file:///wardrobe/201/a.jpg", created[0].imageUrl)
        assertEquals("file:///wardrobe/202/b.jpg", created[1].imageUrl)
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

    private fun wardrobeItemsResponseJson(vararg items: String): String {
        return """
            {
              "items": [${items.joinToString(",")}],
              "total": ${items.size},
              "limit": 100,
              "offset": 0
            }
        """.trimIndent()
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
