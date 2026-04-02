/**
 * Tracks a single configured backend endpoint for stable API origin routing.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

object BackendEndpointRegistry {
    private const val DEFAULT_EMULATOR_BASE_URL = "http://10.0.2.2:8000/"

    @Volatile
    private var configuredBaseUrl: String = DEFAULT_EMULATOR_BASE_URL

    @Volatile
    private var activeBaseUrl: String = DEFAULT_EMULATOR_BASE_URL

    fun initialize(baseUrl: String) {
        val normalized = normalize(baseUrl)
        configuredBaseUrl = normalized
        activeBaseUrl = normalized
    }

    fun activeBaseUrl(): String = activeBaseUrl

    @Suppress("UNUSED_PARAMETER")
    fun candidateBaseUrls(currentUrl: HttpUrl, allowFallback: Boolean): List<String> {
        // Keep all requests on one backend origin to avoid cross-host auth/data drift.
        return listOf(activeBaseUrl)
    }

    fun markReachable(baseUrl: String) {
        activeBaseUrl = normalize(baseUrl)
    }

    fun rewrite(url: HttpUrl, baseUrl: String): HttpUrl {
        val target = normalize(baseUrl).toHttpUrl()
        return url.newBuilder()
            .scheme(target.scheme)
            .host(target.host)
            .port(target.port)
            .build()
    }

    private fun normalize(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        if (trimmed.isBlank()) return DEFAULT_EMULATOR_BASE_URL
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

}
