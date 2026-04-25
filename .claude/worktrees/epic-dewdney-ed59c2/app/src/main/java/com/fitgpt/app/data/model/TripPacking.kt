/**
 * Domain models for trip packing list generation and display.
 */
package com.fitgpt.app.data.model

data class TripPackingItem(
    val category: String,
    val recommendedQuantity: Int,
    val selectedItemIds: List<Int>,
    val selectedItemNames: List<String>,
    val missingQuantity: Int
)

data class TripPackingResult(
    val destinationCity: String,
    val startDate: String,
    val tripDays: Int,
    val weatherSummary: String,
    val items: List<TripPackingItem>,
    val generatedAtTimestamp: Long,
    val insufficientData: Boolean
)
