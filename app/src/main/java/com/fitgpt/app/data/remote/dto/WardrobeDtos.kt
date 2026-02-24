package com.fitgpt.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ClothingItemDto(
    val id: Int,
    @SerializedName("user_id") val userId: Int? = null,
    val category: String,
    val color: String,
    val season: String,
    @SerializedName("comfort_level") val comfortLevel: Int,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class WardrobeListResponse(
    val items: List<ClothingItemDto>
)

data class WardrobeItemResponse(
    val item: ClothingItemDto
)

data class CreateItemRequest(
    val category: String,
    val color: String,
    val season: String,
    val comfortLevel: Int,
    val imageUrl: String? = null
)

data class UpdateItemRequest(
    val category: String,
    val color: String,
    val season: String,
    val comfortLevel: Int,
    val imageUrl: String? = null
)

data class DeleteResponse(
    val success: Boolean
)
