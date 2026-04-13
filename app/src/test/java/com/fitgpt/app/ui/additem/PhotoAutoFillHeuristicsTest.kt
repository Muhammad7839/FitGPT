package com.fitgpt.app.ui.additem

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoAutoFillHeuristicsTest {

    @Test
    fun inferFromFileName_detectsTopAndTeeKeywords() {
        val hint = inferFromFileName("black_tee.jpg")

        assertEquals("Top", hint.category)
        assertEquals("T-Shirt", hint.clothingType)
        assertTrue(hint.confidence < 0.9f)
    }

    @Test
    fun inferFromFileName_keepsUnknownFilesLowConfidence() {
        val hint = inferFromFileName("mystery_item.png")

        assertNull(hint.category)
        assertTrue(hint.confidence < 0.9f)
    }

    @Test
    fun mapRgbToColorName_coversRepresentativePalette() {
        assertEquals("Black", mapRgbToColorName(10, 10, 10))
        assertEquals("Blue", mapRgbToColorName(0, 153, 255))
        assertEquals("Navy", mapRgbToColorName(0, 80, 120))
        assertEquals("Green", mapRgbToColorName(55, 150, 85))
    }
}
