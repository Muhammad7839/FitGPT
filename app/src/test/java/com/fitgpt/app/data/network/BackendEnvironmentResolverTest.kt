/**
 * Verifies runtime backend host selection for emulator and physical Android devices.
 */
package com.fitgpt.app.data.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendEnvironmentResolverTest {

    @Test
    fun emulatorDeviceAlwaysUsesEmulatorHost() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://api.fitgpt.test/",
            physicalLanBaseUrl = "",
            deviceInfo = BackendEnvironmentResolver.DeviceInfo(
                fingerprint = "generic/sdk_gphone64_x86_64",
                model = "Pixel 8",
                hardware = "ranchu"
            )
        )

        assertEquals("http://10.0.2.2:8000/", selected)
    }

    @Test
    fun emulatorDetectionUsesModelCheck() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://api.fitgpt.test/",
            physicalLanBaseUrl = "http://192.168.1.220:8000/",
            deviceInfo = BackendEnvironmentResolver.DeviceInfo(
                fingerprint = "google/device/build",
                model = "Android Emulator",
                hardware = "tensor"
            )
        )

        assertEquals("http://10.0.2.2:8000/", selected)
    }

    @Test
    fun emulatorDetectionUsesHardwareCheck() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://api.fitgpt.test/",
            physicalLanBaseUrl = "http://192.168.1.220:8000/",
            deviceInfo = BackendEnvironmentResolver.DeviceInfo(
                fingerprint = "google/device/build",
                model = "Pixel 7",
                hardware = "goldfish_x86_64"
            )
        )

        assertEquals("http://10.0.2.2:8000/", selected)
    }

    @Test
    fun physicalDeviceUsesConfiguredLanHost() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://api.fitgpt.test/",
            physicalLanBaseUrl = "http://192.168.1.220:8000",
            deviceInfo = BackendEnvironmentResolver.DeviceInfo(
                fingerprint = "google/pixel/pixel:14/AP1A",
                model = "Pixel 7",
                hardware = "tensor"
            )
        )

        assertEquals("http://192.168.1.220:8000/", selected)
    }

    @Test
    fun physicalDeviceFallsBackToConfiguredApiBaseUrlWhenLanMissing() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://api.fitgpt.test",
            physicalLanBaseUrl = "   ",
            deviceInfo = physicalDeviceInfo()
        )

        assertEquals("https://api.fitgpt.test/", selected)
    }

    @Test
    fun physicalDeviceUsesProductionRenderBackendForDemoBuildConfiguration() {
        val selected = BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = "https://fitgpt-backend-tdiq.onrender.com/",
            physicalLanBaseUrl = "   ",
            deviceInfo = physicalDeviceInfo()
        )

        assertEquals("https://fitgpt-backend-tdiq.onrender.com/", selected)
        assertFalse(selected.contains("10.0.2.2"))
    }

    @Test
    fun physicalDeviceRejectsLocalhost() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "https://api.fitgpt.test/",
                physicalLanBaseUrl = "http://localhost:8000/",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not valid for physical devices") == true)
    }

    @Test
    fun physicalDeviceRejectsLoopbackAddress() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "https://api.fitgpt.test/",
                physicalLanBaseUrl = "http://127.0.0.1:8000/",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not valid for physical devices") == true)
    }

    @Test
    fun physicalDeviceRejectsEmulatorBridgeAddress() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "https://api.fitgpt.test/",
                physicalLanBaseUrl = "http://10.0.2.2:8000/",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("not valid for physical devices") == true)
    }

    @Test
    fun physicalDeviceRejectsMalformedLanHost() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "https://api.fitgpt.test/",
                physicalLanBaseUrl = "192.168.1.220:8000",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("API_LAN_BASE_URL is invalid") == true)
    }

    @Test
    fun physicalDeviceRejectsBlankApiBaseUrlWhenLanMissing() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "   ",
                physicalLanBaseUrl = "   ",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("API_BASE_URL is blank") == true)
    }

    @Test
    fun physicalDeviceRejectsLocalhostApiBaseUrlWhenLanMissing() {
        val error = runCatching {
            BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = "http://localhost:8000/",
                physicalLanBaseUrl = "   ",
                deviceInfo = physicalDeviceInfo()
            )
        }.exceptionOrNull()

        assertTrue(error is IllegalStateException)
        assertTrue(error?.message?.contains("API_BASE_URL host") == true)
    }

    @Test
    fun localDevelopmentBaseUrlAllowsLoopbackEmulatorAndPrivateLanHosts() {
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://10.0.2.2:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://127.0.0.1:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://localhost:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://10.1.2.3:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://172.16.0.10:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://172.31.255.10:8000/"))
        assertTrue(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://192.168.1.220:8000/"))
    }

    @Test
    fun localDevelopmentBaseUrlRejectsRemoteAndNonHttpHosts() {
        assertFalse(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("https://fitgpt-api.onrender.com/"))
        assertFalse(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://172.32.0.10:8000/"))
        assertFalse(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("http://8.8.8.8:8000/"))
        assertFalse(BackendEnvironmentResolver.isLocalDevelopmentBaseUrl("not-a-url"))
    }

    private fun physicalDeviceInfo(): BackendEnvironmentResolver.DeviceInfo {
        return BackendEnvironmentResolver.DeviceInfo(
            fingerprint = "samsung/b0qxxx/b0q:14/UP1A",
            model = "SM-S911B",
            hardware = "qcom"
        )
    }
}
