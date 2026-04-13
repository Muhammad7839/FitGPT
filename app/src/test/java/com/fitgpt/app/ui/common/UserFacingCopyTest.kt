package com.fitgpt.app.ui.common

import com.fitgpt.app.viewmodel.WeatherStatusType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test

class UserFacingCopyTest {

    @Test
    fun recommendationWarningLabel_hidesInternalWarningCodes() {
        assertNull(recommendationWarningLabel("provider_auth_failed"))
        assertNull(recommendationWarningLabel("legacy_endpoint_fallback"))
        assertNull(recommendationWarningLabel("fallback"))
    }

    @Test
    fun recommendationSourceLabel_usesUserFacingFallbackCopy() {
        assertEquals("Wardrobe-based styling", recommendationSourceLabel("fallback", fallbackUsed = true))
    }

    @Test
    fun weatherStatusMessage_explainsLocationSucceededButProviderFailed() {
        val message = weatherStatusMessage(
            type = WeatherStatusType.LOCATION_READY_WEATHER_UNAVAILABLE,
            resolvedCity = "Mountain View"
        )

        assertTrue(message.contains("Mountain View"))
        assertTrue(message.contains("Location is working"))
    }
}
