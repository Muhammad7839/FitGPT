/**
 * Normalizes backend relative paths into absolute URLs for Android image loading.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.BuildConfig

private const val FALLBACK_BASE_URL = "http://10.0.2.2:8000/"

internal fun resolveApiUrl(rawUrl: String?): String? {
    val candidate = rawUrl?.trim().orEmpty()
    if (candidate.isEmpty()) return null
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) return candidate

    val baseUrl = BuildConfig.API_BASE_URL.ifBlank { FALLBACK_BASE_URL }.trimEnd('/')
    val path = candidate.trimStart('/')
    return "$baseUrl/$path"
}
