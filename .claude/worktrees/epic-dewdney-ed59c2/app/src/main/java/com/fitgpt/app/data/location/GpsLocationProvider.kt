/**
 * Provides one-shot foreground location coordinates for weather lookups.
 */
package com.fitgpt.app.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.util.Log
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.coroutines.resume

private const val LOCATION_DEBUG_TAG = "LOCATION_DEBUG"
internal const val EMULATOR_DEFAULT_LOCATION_WARNING = "Using emulator default location (Mountain View)"

interface LocationDebugLogger {
    fun debug(message: String)
    fun warning(message: String)
}

private object AndroidLocationDebugLogger : LocationDebugLogger {
    override fun debug(message: String) {
        Log.d(LOCATION_DEBUG_TAG, message)
    }

    override fun warning(message: String) {
        Log.w(LOCATION_DEBUG_TAG, message)
    }
}

data class Coordinates(
    val lat: Double,
    val lon: Double
)

data class LocationContext(
    val lat: Double,
    val lon: Double,
    val city: String?
)

internal fun isEmulatorDefaultLocation(lat: Double, lon: Double): Boolean {
    return abs(lat - 37.42) <= 0.02 && abs(lon - (-122.08)) <= 0.02
}

internal fun logLocationCoordinates(
    logger: LocationDebugLogger,
    lat: Double,
    lon: Double
) {
    logger.debug("lat=$lat lon=$lon")
    if (isEmulatorDefaultLocation(lat, lon)) {
        logger.warning(EMULATOR_DEFAULT_LOCATION_WARNING)
    }
}

internal fun selectBestGeocoderName(
    locality: String?,
    subLocality: String?,
    adminArea: String?,
    featureName: String?
): String? {
    return listOf(locality, subLocality, adminArea, featureName)
        .firstOrNull { !it.isNullOrBlank() }
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
}

class GpsLocationProvider(
    context: Context,
    private val logger: LocationDebugLogger = AndroidLocationDebugLogger
) {
    private val appContext = context.applicationContext
    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentCoordinates(): Coordinates? = suspendCancellableCoroutine { continuation ->
        val tokenSource = CancellationTokenSource()

        fun resumeOnce(result: Coordinates?) {
            if (continuation.isActive) {
                continuation.resume(result)
            }
        }

        fun tryLastKnownLocation() {
            fusedClient
                .lastLocation
                .addOnSuccessListener { location ->
                    val result = if (location == null) {
                        null
                    } else {
                        Coordinates(lat = location.latitude, lon = location.longitude)
                    }
                    resumeOnce(result)
                }
                .addOnFailureListener {
                    resumeOnce(null)
                }
        }

        fusedClient
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.token)
            .addOnSuccessListener { location ->
                if (location == null) {
                    tryLastKnownLocation()
                } else {
                    resumeOnce(Coordinates(lat = location.latitude, lon = location.longitude))
                }
            }
            .addOnFailureListener {
                tryLastKnownLocation()
            }

        continuation.invokeOnCancellation {
            tokenSource.cancel()
        }
    }

    suspend fun getCurrentLocationContext(): LocationContext? {
        val coordinates = getCurrentCoordinates() ?: return null
        logLocationCoordinates(logger, coordinates.lat, coordinates.lon)
        val city = resolveCityName(coordinates.lat, coordinates.lon)
        return LocationContext(
            lat = coordinates.lat,
            lon = coordinates.lon,
            city = city
        )
    }

    private suspend fun resolveCityName(lat: Double, lon: Double): String? {
        return withContext(Dispatchers.IO) {
            runCatching {
                val geocoder = Geocoder(appContext, Locale.getDefault())
                @Suppress("DEPRECATION")
                val address = geocoder.getFromLocation(lat, lon, 1)
                    ?.firstOrNull()
                selectBestGeocoderName(
                    locality = address?.locality,
                    subLocality = address?.subLocality,
                    adminArea = address?.adminArea,
                    featureName = address?.featureName
                )
            }.onFailure {
                logger.warning("Geocoder failed, falling back to last city")
            }.getOrNull()
        }
    }
}
