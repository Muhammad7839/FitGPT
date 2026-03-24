/**
 * Verifies backend endpoint selection and URL rewriting used for local dev connectivity.
 */
package com.fitgpt.app.data.network

import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendEndpointRegistryTest {

    @Test
    fun candidateListIncludesConfiguredAndFallbackHosts() {
        BackendEndpointRegistry.initialize("http://127.0.0.1:8000/")

        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = "http://127.0.0.1:8000/login".toHttpUrl(),
            allowFallback = true
        )

        assertTrue(candidates.contains("http://127.0.0.1:8000/"))
        assertTrue(candidates.contains("http://10.0.2.2:8000/"))
    }

    @Test
    fun rewriteKeepsPathAndQueryWhileSwitchingHost() {
        val original = "http://127.0.0.1:8000/wardrobe/items?limit=10".toHttpUrl()

        val rewritten = BackendEndpointRegistry.rewrite(
            url = original,
            baseUrl = "http://10.0.2.2:8000/"
        )

        assertEquals("http://10.0.2.2:8000/wardrobe/items?limit=10", rewritten.toString())
    }
}
