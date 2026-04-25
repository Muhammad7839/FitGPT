package com.fitgpt.app.data.model

/**
 * Current weather snapshot used to tune and display recommendation context.
 */
data class WeatherSnapshot(
    val city: String,
    val temperatureF: Int? = null,
    val weatherCategory: String? = null,
    val condition: String? = null,
    val description: String? = null,
    val available: Boolean = true,
    val detail: String? = null
)
