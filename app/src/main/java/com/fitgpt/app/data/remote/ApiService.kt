/**
 * Retrofit contract for FitGPT backend endpoints used by Android.
 */
package com.fitgpt.app.data.remote

import com.fitgpt.app.data.remote.dto.ClothingItemCreateRequest
import com.fitgpt.app.data.remote.dto.ClothingItemDto
import com.fitgpt.app.data.remote.dto.ChatRequestDto
import com.fitgpt.app.data.remote.dto.ChatResponseDto
import com.fitgpt.app.data.remote.dto.BulkCreateClothingItemsRequestDto
import com.fitgpt.app.data.remote.dto.BulkCreateClothingItemsResponseDto
import com.fitgpt.app.data.remote.dto.FavoriteToggleRequestDto
import com.fitgpt.app.data.remote.dto.ForgotPasswordRequest
import com.fitgpt.app.data.remote.dto.ForgotPasswordResponse
import com.fitgpt.app.data.remote.dto.GoogleLoginRequest
import com.fitgpt.app.data.remote.dto.ImageBatchUploadResponseDto
import com.fitgpt.app.data.remote.dto.ImageUploadResponseDto
import com.fitgpt.app.data.remote.dto.MessageResponse
import com.fitgpt.app.data.remote.dto.OutfitHistoryRequest
import com.fitgpt.app.data.remote.dto.OutfitHistoryListResponseDto
import com.fitgpt.app.data.remote.dto.OutfitHistoryEntryDto
import com.fitgpt.app.data.remote.dto.OutfitHistoryUpdateRequestDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitAssignmentRequestDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitAssignmentResponseDto
import com.fitgpt.app.data.remote.dto.PlannedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.PlannedOutfitListResponseDto
import com.fitgpt.app.data.remote.dto.PromptFeedbackEventRequestDto
import com.fitgpt.app.data.remote.dto.PromptFeedbackEventResponseDto
import com.fitgpt.app.data.remote.dto.RecommendationResponseDto
import com.fitgpt.app.data.remote.dto.RecommendationOptionsResponseDto
import com.fitgpt.app.data.remote.dto.AiRecommendationRequestDto
import com.fitgpt.app.data.remote.dto.AiRecommendationResponseDto
import com.fitgpt.app.data.remote.dto.RecommendationFeedbackRequestDto
import com.fitgpt.app.data.remote.dto.RecommendationFeedbackResponseDto
import com.fitgpt.app.data.remote.dto.TagSuggestionResponseDto
import com.fitgpt.app.data.remote.dto.RejectOutfitRequestDto
import com.fitgpt.app.data.remote.dto.RejectOutfitResponseDto
import com.fitgpt.app.data.remote.dto.UnderusedAlertsResponseDto
import com.fitgpt.app.data.remote.dto.RegisterRequest
import com.fitgpt.app.data.remote.dto.ResetPasswordRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitCreateRequest
import com.fitgpt.app.data.remote.dto.SavedOutfitListResponseDto
import com.fitgpt.app.data.remote.dto.TokenResponse
import com.fitgpt.app.data.remote.dto.TripPackingRequestDto
import com.fitgpt.app.data.remote.dto.TripPackingResponseDto
import com.fitgpt.app.data.remote.dto.AvatarUploadResponse
import com.fitgpt.app.data.remote.dto.UserProfileSummaryResponse
import com.fitgpt.app.data.remote.dto.UserProfileUpdateRequest
import com.fitgpt.app.data.remote.dto.UserResponse
import com.fitgpt.app.data.remote.dto.WardrobeGapResponseDto
import com.fitgpt.app.data.remote.dto.WeatherCurrentResponseDto
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.PartMap
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import okhttp3.MultipartBody
import okhttp3.RequestBody

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

    @POST("onboarding/complete")
    suspend fun completeOnboarding(
        @Body payload: UserProfileUpdateRequest
    ): UserResponse

    @GET("me/summary")
    suspend fun getProfileSummary(): UserProfileSummaryResponse

    @Multipart
    @POST("me/avatar")
    suspend fun uploadMyAvatar(
        @Part image: MultipartBody.Part
    ): AvatarUploadResponse

    @GET("wardrobe/items")
    suspend fun getWardrobeItems(
        @Query("include_archived") includeArchived: Boolean = false,
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("color") color: String? = null,
        @Query("clothing_type") clothingType: String? = null,
        @Query("season") season: String? = null,
        @Query("fit_tag") fitTag: String? = null,
        @Query("layer_type") layerType: String? = null,
        @Query("is_one_piece") isOnePiece: Boolean? = null,
        @Query("set_identifier") setIdentifier: String? = null,
        @Query("style_tag") styleTag: String? = null,
        @Query("season_tag") seasonTag: String? = null,
        @Query("occasion_tag") occasionTag: String? = null,
        @Query("accessory_type") accessoryType: String? = null,
        @Query("favorites_only") favoritesOnly: Boolean = false
    ): List<ClothingItemDto>

    @GET("wardrobe/items/favorites")
    suspend fun getFavoriteWardrobeItems(): List<ClothingItemDto>

    @GET("wardrobe/gaps")
    suspend fun getWardrobeGaps(): WardrobeGapResponseDto

    @GET("wardrobe/underused-alerts")
    suspend fun getUnderusedAlerts(
        @Query("analysis_window_days") analysisWindowDays: Int = 21,
        @Query("max_results") maxResults: Int = 20
    ): UnderusedAlertsResponseDto

    @POST("wardrobe/items")
    suspend fun addWardrobeItem(
        @Body payload: ClothingItemCreateRequest
    ): ClothingItemDto

    @Multipart
    @POST("wardrobe/items")
    suspend fun addWardrobeItemMultipart(
        @PartMap payload: Map<String, @JvmSuppressWildcards RequestBody>,
        @Part image: MultipartBody.Part
    ): ClothingItemDto

    @POST("wardrobe/items/bulk")
    suspend fun addWardrobeItemsBulk(
        @Body payload: BulkCreateClothingItemsRequestDto
    ): BulkCreateClothingItemsResponseDto

    @POST("wardrobe/tags/suggest")
    suspend fun suggestWardrobeTags(
        @Body payload: ClothingItemCreateRequest
    ): TagSuggestionResponseDto

    @Multipart
    @POST("wardrobe/items/image")
    suspend fun uploadWardrobeImage(
        @Part image: MultipartBody.Part
    ): ImageUploadResponseDto

    @Multipart
    @POST("wardrobe/items/images")
    suspend fun uploadWardrobeImages(
        @Part images: List<MultipartBody.Part>
    ): ImageBatchUploadResponseDto

    @PUT("wardrobe/items/{itemId}")
    suspend fun updateWardrobeItem(
        @Path("itemId") itemId: Int,
        @Body payload: ClothingItemCreateRequest
    ): ClothingItemDto

    @POST("wardrobe/items/{itemId}/favorite")
    suspend fun toggleWardrobeFavorite(
        @Path("itemId") itemId: Int,
        @Body payload: FavoriteToggleRequestDto
    ): ClothingItemDto

    @GET("wardrobe/items/{itemId}/tag-suggestions")
    suspend fun getWardrobeItemTagSuggestions(
        @Path("itemId") itemId: Int
    ): TagSuggestionResponseDto

    @POST("wardrobe/items/{itemId}/tag-suggestions/apply")
    suspend fun applyWardrobeItemTagSuggestions(
        @Path("itemId") itemId: Int
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
        @Query("weather_lat") weatherLat: Double? = null,
        @Query("weather_lon") weatherLon: Double? = null,
        @Query("weather_category") weatherCategory: String? = null,
        @Query("occasion") occasion: String? = null,
    ): RecommendationResponseDto

    @GET("recommendations/options")
    suspend fun getRecommendationOptions(
        @Query("manual_temp") manualTemp: Int? = null,
        @Query("time_context") timeContext: String? = null,
        @Query("plan_date") planDate: String? = null,
        @Query("exclude") exclude: String? = null,
        @Query("weather_city") weatherCity: String? = null,
        @Query("weather_lat") weatherLat: Double? = null,
        @Query("weather_lon") weatherLon: Double? = null,
        @Query("weather_category") weatherCategory: String? = null,
        @Query("occasion") occasion: String? = null,
        @Query("limit") limit: Int = 3,
    ): RecommendationOptionsResponseDto

    @POST("ai/recommendations")
    suspend fun getAiRecommendations(
        @Body payload: AiRecommendationRequestDto
    ): AiRecommendationResponseDto

    @POST("recommendations/reject")
    suspend fun rejectRecommendation(
        @Body payload: RejectOutfitRequestDto
    ): RejectOutfitResponseDto

    @POST("feedback/prompts/event")
    suspend fun recordPromptFeedbackEvent(
        @Body payload: PromptFeedbackEventRequestDto
    ): PromptFeedbackEventResponseDto

    @POST("recommendations/feedback")
    suspend fun submitRecommendationFeedback(
        @Body payload: RecommendationFeedbackRequestDto
    ): RecommendationFeedbackResponseDto

    @POST("ai/chat")
    suspend fun sendChatMessage(
        @Body payload: ChatRequestDto
    ): ChatResponseDto

    @GET("weather/current")
    suspend fun getCurrentWeather(
        @Query("city") city: String? = null,
        @Query("lat") lat: Double? = null,
        @Query("lon") lon: Double? = null
    ): WeatherCurrentResponseDto

    @POST("outfits/history")
    suspend fun saveOutfitHistory(
        @Body payload: OutfitHistoryRequest
    )

    @GET("outfits/history")
    suspend fun getOutfitHistory(): OutfitHistoryListResponseDto

    @GET("outfits/history/range")
    suspend fun getOutfitHistoryInRange(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): OutfitHistoryListResponseDto

    @DELETE("outfits/history")
    suspend fun clearOutfitHistory()

    @PUT("outfits/history/{historyId}")
    suspend fun updateOutfitHistoryEntry(
        @Path("historyId") historyId: Long,
        @Body payload: OutfitHistoryUpdateRequestDto
    ): OutfitHistoryEntryDto

    @DELETE("outfits/history/{historyId}")
    suspend fun deleteOutfitHistoryEntry(
        @Path("historyId") historyId: Long
    ): MessageResponse

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

    @PUT("outfits/planned/assign")
    suspend fun assignPlannedOutfit(
        @Body payload: PlannedOutfitAssignmentRequestDto
    ): PlannedOutfitAssignmentResponseDto

    @DELETE("outfits/planned/{outfitId}")
    suspend fun deletePlannedOutfit(
        @Path("outfitId") outfitId: Long
    ): PlannedOutfitListResponseDto

    @POST("plans/packing-list")
    suspend fun generateTripPackingList(
        @Body payload: TripPackingRequestDto
    ): TripPackingResponseDto
}
