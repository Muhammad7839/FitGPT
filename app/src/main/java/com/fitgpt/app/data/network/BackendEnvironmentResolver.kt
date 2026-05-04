/**
 * Selects one runtime backend origin based on device environment and validates local overrides.
 */
package com.fitgpt.app.data.network

import android.os.Build
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object BackendEnvironmentResolver {
    private const val PRODUCTION_BASE_URL = "https://fitgpt-backend-tdiq.onrender.com/"

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
        val normalizedLanBaseUrl = normalizeOrBlank(physicalLanBaseUrl)
        if (normalizedLanBaseUrl.isNotBlank()) {
            return validateExplicitLocalBaseUrl(normalizedLanBaseUrl, deviceInfo)
        }

        return validateApiBaseUrl(apiBaseUrl.ifBlank { PRODUCTION_BASE_URL })
    }

    fun isLocalDevelopmentBaseUrl(baseUrl: String): Boolean {
        val parsed = normalizeOrBlank(baseUrl).toHttpUrlOrNull() ?: return false
        if (parsed.scheme != "http") return false

        val host = parsed.host.lowercase()
        if (host == "localhost" || host == "10.0.2.2" || host.startsWith("127.")) {
            return true
        }

        return isPrivateLanHost(host)
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

    private fun validateExplicitLocalBaseUrl(normalized: String, deviceInfo: DeviceInfo): String {
        val parsed = normalized.toHttpUrlOrNull()
            ?: throw IllegalStateException("API_LAN_BASE_URL is invalid: $normalized")

        val blockedHosts = if (isEmulator(deviceInfo)) {
            setOf("localhost", "127.0.0.1")
        } else {
            setOf("localhost", "127.0.0.1", "10.0.2.2")
        }
        if (parsed.host.lowercase() in blockedHosts) {
            throw IllegalStateException(
                "API_LAN_BASE_URL host '${parsed.host}' is not valid for this Android runtime. Use 10.0.2.2 for emulators or your Mac LAN IP for physical devices."
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

    private fun isPrivateLanHost(host: String): Boolean {
        val parts = host.split('.')
        if (parts.size != 4) return false
        val octets = parts.map { part ->
            part.toIntOrNull()?.takeIf { it in 0..255 } ?: return false
        }

        val first = octets[0]
        val second = octets[1]
        return first == 10 ||
            (first == 172 && second in 16..31) ||
            (first == 192 && second == 168)
    }
}
