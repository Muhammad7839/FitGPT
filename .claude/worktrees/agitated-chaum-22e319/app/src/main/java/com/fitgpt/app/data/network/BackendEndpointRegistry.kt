/**
 * Tracks a single configured backend endpoint for stable API origin routing.
 */
package com.fitgpt.app.data.network

import com.fitgpt.app.BuildConfig
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

object BackendEndpointRegistry {
    @Volatile
    private var configuredBaseUrl: String = defaultBaseUrl()

    @Volatile
    private var activeBaseUrl: String = defaultBaseUrl()

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
        if (trimmed.isBlank()) return defaultBaseUrl()
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    private fun defaultBaseUrl(): String {
        val configured = BuildConfig.API_BASE_URL.trim()
        if (configured.isBlank()) return ""
        return if (configured.endsWith("/")) configured else "$configured/"
    }
}
