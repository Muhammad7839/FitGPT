package com.fitgpt.app.data.remote.dto

data class RecommendationResponse(
    val outfit: List<ClothingItemDto>,
    val explanation: ExplanationDto
)

data class ExplanationDto(
    val summary: String,
    val fitLogic: String
)
