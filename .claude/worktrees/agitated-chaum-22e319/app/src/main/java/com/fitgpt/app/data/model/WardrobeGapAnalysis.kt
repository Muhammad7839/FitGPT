/**
 * Domain models for wardrobe gap analysis and suggested item metadata.
 */
package com.fitgpt.app.data.model

data class WardrobeGapSuggestion(
    val category: String,
    val itemName: String,
    val reason: String,
    val imageUrl: String?,
    val shoppingLink: String
)

data class WardrobeGapAnalysis(
    val baselineCategories: List<String>,
    val categoryCounts: Map<String, Int>,
    val missingCategories: List<String>,
    val suggestions: List<WardrobeGapSuggestion>,
    val insufficientData: Boolean
)
