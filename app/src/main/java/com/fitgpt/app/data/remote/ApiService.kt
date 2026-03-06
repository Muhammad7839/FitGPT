package com.fitgpt.app.data.remote

import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.RecommendationResponseDto
import com.fitgpt.app.data.remote.dto.TokenResponse
import com.fitgpt.app.data.remote.dto.UserProfileUpdateRequest
import com.fitgpt.app.data.remote.dto.UserResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @FormUrlEncoded
    @POST("login")
    suspend fun login(
        @Field("username") email: String,
        @Field("password") password: String,
    ): TokenResponse

    @GET("me")
    suspend fun getCurrentUser(): UserResponse

    @PUT("me/profile")
    suspend fun updateMyProfile(
        @Body payload: UserProfileUpdateRequest
    ): UserResponse

    @GET("wardrobe/items")
    suspend fun getWardrobeItems(): List<ClothingItemDto>

    @POST("wardrobe/items")
    suspend fun addWardrobeItem(
        @Body payload: ClothingItemCreateRequest
    ): ClothingItemDto

    @PUT("wardrobe/items/{itemId}")
    suspend fun updateWardrobeItem(
        @Path("itemId") itemId: Int,
        @Body payload: ClothingItemCreateRequest
    ): ClothingItemDto

    @DELETE("wardrobe/items/{itemId}")
    suspend fun deleteWardrobeItem(
        @Path("itemId") itemId: Int
    )

    @GET("recommendations")
    suspend fun getRecommendations(
        @Query("manual_temp") manualTemp: Int? = null,
        @Query("time_context") timeContext: String? = null,
        @Query("plan_date") planDate: String? = null,
        @Query("exclude") exclude: String? = null,
    ): RecommendationResponseDto

    @POST("outfits/history")
    suspend fun saveOutfitHistory(
        @Body payload: OutfitHistoryRequest
    )
}
