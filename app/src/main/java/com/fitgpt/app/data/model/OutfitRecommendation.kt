package com.fitgpt.app.data.model

data class OutfitRecommendation(
    val items: List<ClothingItem>,
    val score: Double,
    val explanation: String
)
