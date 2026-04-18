/**
 * Verifies backend endpoint selection stays pinned to one configured origin.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class BackendEndpointRegistryTest {
    private val renderBaseUrl = "https://fitgpt-backend-tiiq.onrender.com/"

    @Test
    fun candidateListReturnsOnlyConfiguredHost() {
        BackendEndpointRegistry.initialize(renderBaseUrl)

        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = "https://fitgpt-backend-tiiq.onrender.com/login".toHttpUrl(),
            allowFallback = true
        )

        assertEquals(listOf(renderBaseUrl), candidates)
    }

    @Test
    fun candidateListIgnoresAlternateCurrentUrlHost() {
        BackendEndpointRegistry.initialize(renderBaseUrl)

        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = "https://example.com/me".toHttpUrl(),
            allowFallback = true
        )

        assertEquals(listOf(renderBaseUrl), candidates)
    }

    @Test
    fun rewriteKeepsPathAndQueryWithPinnedHost() {
        val original = "https://fitgpt-backend-tiiq.onrender.com/wardrobe/items?limit=10".toHttpUrl()

        val rewritten = BackendEndpointRegistry.rewrite(
            url = original,
            baseUrl = renderBaseUrl
        )

        assertEquals(
            "https://fitgpt-backend-tiiq.onrender.com/wardrobe/items?limit=10",
            rewritten.toString()
        )
    }
}
