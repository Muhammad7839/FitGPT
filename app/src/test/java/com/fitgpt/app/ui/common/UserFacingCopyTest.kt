package com.fitgpt.app.ui.common

import org.junit.Assert.assertEquals
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
}
