package com.fitgpt.app.data.location

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GpsLocationProviderTest {

    @Test
    fun logLocationCoordinates_warnsWhenUsingEmulatorDefaultMountainViewCoordinates() {
        val warnings = mutableListOf<String>()
        val logger = object : LocationDebugLogger {
            override fun debug(message: String) = Unit
            override fun warning(message: String) {
                warnings += message
            }
        }

        logLocationCoordinates(
            logger = logger,
            lat = 37.42,
            lon = -122.08
        )

        assertTrue(warnings.contains(EMULATOR_DEFAULT_LOCATION_WARNING))
    }

    @Test
    fun selectBestGeocoderName_usesRequestedFallbackOrder() {
        val resolved = selectBestGeocoderName(
            locality = null,
            subLocality = "SOMA",
            adminArea = "California",
            featureName = "Market Street"
        )

        assertEquals("SOMA", resolved)
    }
}
