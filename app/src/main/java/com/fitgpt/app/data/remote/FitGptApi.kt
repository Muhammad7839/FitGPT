package com.fitgpt.app.data.remote

import com.fitgpt.app.data.remote.dto.*
import retrofit2.http.*

interface FitGptApi {

    // Auth
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @POST("api/auth/guest")
    suspend fun guestLogin(@Body request: GuestRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun getMe(): AuthResponse

    // Wardrobe
    @GET("api/wardrobe")
    suspend fun getWardrobeItems(): WardrobeListResponse

    @POST("api/wardrobe")
    suspend fun addItem(@Body request: CreateItemRequest): WardrobeItemResponse

    @PUT("api/wardrobe/{id}")
    suspend fun updateItem(@Path("id") id: Int, @Body request: UpdateItemRequest): WardrobeItemResponse

    @DELETE("api/wardrobe/{id}")
    suspend fun deleteItem(@Path("id") id: Int): DeleteResponse

    // Recommendations
    @GET("api/recommendations")
    suspend fun getRecommendations(): RecommendationResponse
}
