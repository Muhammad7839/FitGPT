/**
 * Tracks backend base URL candidates and remembers the last reachable endpoint.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

object BackendEndpointRegistry {
    private const val DEFAULT_EMULATOR_BASE_URL = "http://10.0.2.2:8000/"
    private const val DEFAULT_LOCALHOST_BASE_URL = "http://127.0.0.1:8000/"
    private const val DEFAULT_LOOPBACK_BASE_URL = "http://localhost:8000/"

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

    fun candidateBaseUrls(currentUrl: HttpUrl, allowFallback: Boolean): List<String> {
        val candidates = linkedSetOf<String>()
        candidates += normalizeFromUrl(currentUrl)
        candidates += activeBaseUrl
        if (allowFallback) {
            candidates += configuredBaseUrl
            candidates += DEFAULT_EMULATOR_BASE_URL
            candidates += DEFAULT_LOCALHOST_BASE_URL
            candidates += DEFAULT_LOOPBACK_BASE_URL
        }
        return candidates.toList()
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

    private fun normalizeFromUrl(url: HttpUrl): String {
        return "${url.scheme}://${url.host}:${url.port}/"
    }
}
