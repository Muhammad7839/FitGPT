/**
 * Provides one-shot foreground location coordinates for weather lookups.
 */
package com.fitgpt.app.data.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

data class Coordinates(
    val lat: Double,
    val lon: Double
)

data class LocationContext(
    val lat: Double,
    val lon: Double,
    val city: String?
)

class GpsLocationProvider(context: Context) {
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
                address?.locality
                    ?: address?.subAdminArea
                    ?: address?.adminArea
            }.getOrNull()?.trim()?.takeIf { it.isNotEmpty() }
        }
    }
}
