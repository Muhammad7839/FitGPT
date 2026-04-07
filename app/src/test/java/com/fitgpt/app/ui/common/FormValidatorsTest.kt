package com.fitgpt.app.ui.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FormValidatorsTest {

    @Test
    fun validateClothingItemForm_returnsErrorForBlankCategory() {
        val result = validateClothingItemForm(
            category = "   ",
            color = "Black",
            season = "Winter",
            comfortText = "3"
        )

        assertEquals("Category is required", result)
    }

    @Test
    fun validateClothingItemForm_returnsErrorForOutOfRangeComfort() {
        val result = validateClothingItemForm(
            category = "Top",
            color = "Black",
            season = "Winter",
            comfortText = "9"
        )

        assertEquals("Comfort level must be between 1 and 5", result)
    }

    @Test
    fun validateClothingItemForm_returnsNullForValidPayload() {
        val result = validateClothingItemForm(
            category = "Top",
            color = "Black",
            season = "Winter",
            comfortText = "4"
        )

        assertNull(result)
    }

    @Test
    fun parseComfortLevel_fallsBackToDefaultWhenInvalid() {
        assertEquals(3, parseComfortLevel("invalid"))
    }

    @Test
    fun isImagePayloadAllowed_checksByteLimit() {
        assertTrue(isImagePayloadAllowed(1024))
        assertFalse(isImagePayloadAllowed(MAX_LOCAL_IMAGE_BYTES + 1))
    }

    @Test
    fun isValidPlanDate_acceptsIsoAndRejectsNonIso() {
        assertTrue(isValidPlanDate("2026-04-01"))
        assertFalse(isValidPlanDate("04-01-2026"))
    }
}
