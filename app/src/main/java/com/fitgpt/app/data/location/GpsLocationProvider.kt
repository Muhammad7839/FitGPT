/**
 * Provides one-shot foreground location coordinates for weather lookups.
 */
package com.fitgpt.app.data.location

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class Coordinates(
    val lat: Double,
    val lon: Double
)

class GpsLocationProvider(context: Context) {
    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentCoordinates(): Coordinates? = suspendCancellableCoroutine { continuation ->
        val tokenSource = CancellationTokenSource()
        fusedClient
            .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, tokenSource.token)
            .addOnSuccessListener { location ->
                val result = if (location == null) {
                    null
                } else {
                    Coordinates(lat = location.latitude, lon = location.longitude)
                }
                continuation.resume(result)
            }
            .addOnFailureListener {
                continuation.resume(null)
            }

        continuation.invokeOnCancellation {
            tokenSource.cancel()
        }
    }
}
