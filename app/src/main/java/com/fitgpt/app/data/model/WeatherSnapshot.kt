package com.fitgpt.app.data.model

/**
 * Current weather snapshot used to tune and display recommendation context.
 */
data class WeatherSnapshot(
    val city: String,
    val temperatureF: Int,
    val condition: String,
    val description: String
)
