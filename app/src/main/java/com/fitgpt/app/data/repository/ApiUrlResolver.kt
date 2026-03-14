/**
 * Normalizes backend relative paths into absolute URLs for Android image loading.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.network.BackendEndpointRegistry

internal fun resolveApiUrl(rawUrl: String?): String? {
    val candidate = rawUrl?.trim().orEmpty()
    if (candidate.isEmpty()) return null
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) return candidate

    val baseUrl = BackendEndpointRegistry.activeBaseUrl().trimEnd('/')
    val path = candidate.trimStart('/')
    return "$baseUrl/$path"
}
