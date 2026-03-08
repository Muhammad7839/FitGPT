package com.fitgpt.app.data.remote

import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.ForgotPasswordRequest
import com.fitgpt.app.data.remote.dto.ForgotPasswordResponse
import com.fitgpt.app.data.remote.dto.GoogleLoginRequest
import com.fitgpt.app.data.remote.dto.ImageUploadResponseDto
import com.fitgpt.app.data.remote.dto.MessageResponse
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.OutfitHistoryListResponseDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.PlannedOutfitListResponseDto
import com.fitgpt.app.data.remote.dto.RecommendationResponseDto
import com.fitgpt.app.data.remote.dto.RegisterRequest
import com.fitgpt.app.data.remote.dto.ResetPasswordRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitListResponseDto
import com.fitgpt.app.data.remote.dto.TokenResponse
import com.fitgpt.app.data.remote.dto.UserProfileUpdateRequest
import com.fitgpt.app.data.remote.dto.UserResponse
import com.fitgpt.app.data.remote.dto.WeatherCurrentResponseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import okhttp3.MultipartBody

interface ApiService {

    @FormUrlEncoded
    @POST("login")
    suspend fun login(
        @Field("username") email: String,
        @Field("password") password: String,
    ): TokenResponse

    @POST("register")
    suspend fun register(
        @Body payload: RegisterRequest
    ): UserResponse

    @POST("login/google")
    suspend fun loginWithGoogle(
        @Body payload: GoogleLoginRequest
    ): TokenResponse

    @POST("forgot-password")
    suspend fun forgotPassword(
        @Body payload: ForgotPasswordRequest
    ): ForgotPasswordResponse

    @POST("reset-password")
    suspend fun resetPassword(
        @Body payload: ResetPasswordRequest
    ): MessageResponse

    @GET("me")
    suspend fun getCurrentUser(): UserResponse

    @PUT("me/profile")
    suspend fun updateMyProfile(
        @Body payload: UserProfileUpdateRequest
    ): UserResponse

    @GET("wardrobe/items")
    suspend fun getWardrobeItems(
        @Query("include_archived") includeArchived: Boolean = false
    ): List<ClothingItemDto>

    @POST("wardrobe/items")
    suspend fun addWardrobeItem(
        @Body payload: ClothingItemCreateRequest
    ): ClothingItemDto

    @Multipart
    @POST("wardrobe/items/image")
    suspend fun uploadWardrobeImage(
        @Part image: MultipartBody.Part
    ): ImageUploadResponseDto

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
        @Query("weather_city") weatherCity: String? = null,
    ): RecommendationResponseDto

    @GET("weather/current")
    suspend fun getCurrentWeather(
        @Query("city") city: String
    ): WeatherCurrentResponseDto

    @POST("outfits/history")
    suspend fun saveOutfitHistory(
        @Body payload: OutfitHistoryRequest
    )

    @GET("outfits/history")
    suspend fun getOutfitHistory(): OutfitHistoryListResponseDto

    @DELETE("outfits/history")
    suspend fun clearOutfitHistory()

    @GET("outfits/saved")
    suspend fun getSavedOutfits(): SavedOutfitListResponseDto

    @POST("outfits/saved")
    suspend fun saveOutfit(
        @Body payload: SavedOutfitCreateRequest
    ): SavedOutfitListResponseDto

    @DELETE("outfits/saved/{outfitId}")
    suspend fun deleteSavedOutfit(
        @Path("outfitId") outfitId: Int
    ): SavedOutfitListResponseDto

    @GET("outfits/planned")
    suspend fun getPlannedOutfits(): PlannedOutfitListResponseDto

    @POST("outfits/planned")
    suspend fun savePlannedOutfit(
        @Body payload: PlannedOutfitCreateRequest
    ): PlannedOutfitListResponseDto

    @DELETE("outfits/planned/{outfitId}")
    suspend fun deletePlannedOutfit(
        @Path("outfitId") outfitId: Long
    ): PlannedOutfitListResponseDto
}
