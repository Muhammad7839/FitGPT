/**
 * Selects one runtime backend origin based on device environment and validates physical LAN config.
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
        physicalLanBaseUrl: String,
        deviceInfo: DeviceInfo = currentDeviceInfo()
    ): String {
        return if (isEmulator(deviceInfo)) {
            EMULATOR_BASE_URL
        } else {
            validatePhysicalLanBaseUrl(physicalLanBaseUrl)
        }
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
            deviceInfo.hardware.contains("goldfish", ignoreCase = true)
    }

    private fun validatePhysicalLanBaseUrl(rawBaseUrl: String): String {
        val normalized = normalizeOrBlank(rawBaseUrl)
        if (normalized.isBlank()) {
            throw IllegalStateException(
                "API_LAN_BASE_URL is blank. Configure a LAN host such as http://192.168.x.x:8000/ for physical devices."
            )
        }

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

    private fun normalizeOrBlank(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        if (trimmed.isBlank()) return ""
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}
