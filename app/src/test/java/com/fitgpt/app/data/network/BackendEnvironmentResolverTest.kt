package com.fitgpt.app.data.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendEnvironmentResolverTest {

    @Test
    fun resolveBaseUrl_acceptsRenderHost() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            "https://fitgpt-backend-tiiq.onrender.com"
        )

        assertEquals("https://fitgpt-backend-tiiq.onrender.com/", selected)
    }

    @Test
    fun resolveBaseUrl_rejectsLocalhost() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl("http://localhost:8000/")
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not demo-safe") == true)
    }

    @Test
    fun resolveBaseUrl_rejectsLoopbackAddress() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl("http://127.0.0.1:8000/")
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not demo-safe") == true)
    }

    @Test
    fun resolveBaseUrl_rejectsEmulatorBridgeAddress() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl("http://10.0.2.2:8000/")
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not demo-safe") == true)
    }
}
