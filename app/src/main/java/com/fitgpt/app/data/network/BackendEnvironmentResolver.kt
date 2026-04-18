/**
 * Selects one runtime backend origin based on device environment and validates local overrides.
 */
package com.fitgpt.app.data.network

import android.os.Build
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object BackendEnvironmentResolver {
    private const val EMULATOR_BASE_URL = "http://10.0.2.2:8000/"

    data class DeviceInfo(
        val fingerprint: String,
        val model: String,
        val hardware: String
    )

    fun resolveBaseUrl(
        apiBaseUrl: String,
        physicalLanBaseUrl: String,
        deviceInfo: DeviceInfo = currentDeviceInfo()
    ): String {
        if (isEmulator(deviceInfo)) {
            return EMULATOR_BASE_URL
        }

        val normalizedLanBaseUrl = normalizeOrBlank(physicalLanBaseUrl)
        if (normalizedLanBaseUrl.isNotBlank()) {
            return validatePhysicalLanBaseUrl(normalizedLanBaseUrl)
        }

        return validateApiBaseUrl(apiBaseUrl)
    }

    private fun currentDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            fingerprint = Build.FINGERPRINT.orEmpty(),
            model = Build.MODEL.orEmpty(),
            hardware = Build.HARDWARE.orEmpty()
        )
    }

    private fun isEmulator(deviceInfo: DeviceInfo): Boolean {
        return deviceInfo.fingerprint.contains("generic", ignoreCase = true) ||
            deviceInfo.model.contains("Emulator", ignoreCase = true) ||
            deviceInfo.hardware.contains("goldfish", ignoreCase = true) ||
            deviceInfo.hardware.contains("ranchu", ignoreCase = true)
    }

    private fun validatePhysicalLanBaseUrl(normalized: String): String {
        val parsed = normalized.toHttpUrlOrNull()
            ?: throw IllegalStateException("API_LAN_BASE_URL is invalid: $normalized")

        val blockedHosts = setOf("localhost", "127.0.0.1", "10.0.2.2")
        if (parsed.host.lowercase() in blockedHosts) {
            throw IllegalStateException(
                "API_LAN_BASE_URL host '${parsed.host}' is not valid for physical devices. Use your Mac LAN IP."
            )
        }
        return normalized
    }

    private fun validateApiBaseUrl(rawBaseUrl: String): String {
        val normalized = normalizeOrBlank(rawBaseUrl)
        if (normalized.isBlank()) {
            throw IllegalStateException(
                "API_BASE_URL is blank. Set API_BASE_URL for production or provide API_LAN_BASE_URL for physical devices."
            )
        }

        val parsed = normalized.toHttpUrlOrNull()
            ?: throw IllegalStateException("API_BASE_URL is invalid: $normalized")

        if (parsed.host.lowercase() == "localhost") {
            throw IllegalStateException(
                "API_BASE_URL host '${parsed.host}' is not valid for Android devices. Use API_LAN_BASE_URL or a reachable deployed backend."
            )
        }

        return normalized
    }

    private fun normalizeOrBlank(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        if (trimmed.isBlank()) return ""
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}
