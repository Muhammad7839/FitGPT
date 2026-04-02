/**
 * Verifies backend endpoint selection stays pinned to one configured origin.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Test

class BackendEndpointRegistryTest {

    @Test
    fun candidateListReturnsOnlyConfiguredHost() {
        BackendEndpointRegistry.initialize("http://127.0.0.1:8000/")

        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = "http://127.0.0.1:8000/login".toHttpUrl(),
            allowFallback = true
        )

        assertEquals(listOf("http://127.0.0.1:8000/"), candidates)
    }

    @Test
    fun candidateListIgnoresAlternateCurrentUrlHost() {
        BackendEndpointRegistry.initialize("http://127.0.0.1:8000/")

        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = "http://10.0.2.2:8000/me".toHttpUrl(),
            allowFallback = true
        )

        assertEquals(listOf("http://127.0.0.1:8000/"), candidates)
    }

    @Test
    fun rewriteKeepsPathAndQueryWithPinnedHost() {
        val original = "http://127.0.0.1:8000/wardrobe/items?limit=10".toHttpUrl()

        val rewritten = BackendEndpointRegistry.rewrite(
            url = original,
            baseUrl = "http://127.0.0.1:8000/"
        )

        assertEquals("http://127.0.0.1:8000/wardrobe/items?limit=10", rewritten.toString())
    }
}
