/**
 * Validates the single configured backend origin used by the Android app.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object BackendEnvironmentResolver {
    private const val REQUIRED_HOST = "fitgpt-backend-tiiq.onrender.com"

    fun resolveBaseUrl(baseUrl: String): String {
        val normalized = normalizeOrThrow(
            rawBaseUrl = baseUrl,
            fieldName = "API_BASE_URL",
            blankMessage = "API_BASE_URL is blank."
        )
        val parsed = normalized.toHttpUrlOrNull()
            ?: throw IllegalStateException("API_BASE_URL is invalid: $normalized")
        if (parsed.host.lowercase() != REQUIRED_HOST) {
            throw IllegalStateException(
                "API_BASE_URL host '${parsed.host}' is not demo-safe. Use $REQUIRED_HOST."
            )
        }
        return normalized
    }

    private fun normalizeOrBlank(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        if (trimmed.isBlank()) return ""
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    private fun normalizeOrThrow(
        rawBaseUrl: String,
        fieldName: String,
        blankMessage: String = "$fieldName is blank."
    ): String {
        val normalized = normalizeOrBlank(rawBaseUrl)
        if (normalized.isBlank()) {
            throw IllegalStateException(blankMessage)
        }
        return normalized
    }
}
