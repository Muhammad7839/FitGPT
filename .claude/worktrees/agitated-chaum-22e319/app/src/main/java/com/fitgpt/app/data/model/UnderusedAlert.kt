/**
 * Domain models for underused clothing alert summaries.
 */
package com.fitgpt.app.data.model

data class UnderusedAlert(
    val itemId: Int,
    val itemName: String,
    val category: String,
    val wearCount: Int,
    val lastWornTimestamp: Long?,
    val daysSinceWorn: Int?,
    val alertLevel: String
)

data class UnderusedAlertsResult(
    val generatedAtTimestamp: Long,
    val analysisWindowDays: Int,
    val alerts: List<UnderusedAlert>,
    val insufficientData: Boolean
)
