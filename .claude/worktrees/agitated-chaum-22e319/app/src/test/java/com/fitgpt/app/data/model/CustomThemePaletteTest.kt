package com.fitgpt.app.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class CustomThemePaletteTest {

    @Test
    fun customTheme_roundTripSerialization() {
        val payload = """
            {
              "name":"My Theme",
              "accentHex":"#C43C3C",
              "backgroundHex":"#141418",
              "textHex":"#E8E6E3",
              "surfaceHex":"#1C1C22",
              "accentHoverHex":"#E04B4B",
              "borderHex":"#2F2F36",
              "mutedHex":"#A7A4A0"
            }
        """.trimIndent()

        val decoded = CustomThemePalette.fromJson(payload)
        assertNotNull(decoded)
        assertEquals("My Theme", decoded?.name)
        assertEquals("#C43C3C", decoded?.accentHex)
        assertEquals("#141418", decoded?.backgroundHex)
    }

    @Test
    fun customTheme_invalidPayloadReturnsNull() {
        assertNull(CustomThemePalette.fromJson("{invalid-json"))
    }

    @Test
    fun normalizeHex_acceptsHashlessInput() {
        assertEquals("#AABBCC", CustomThemePalette.normalizeHex("aabbcc", "#000000"))
        assertEquals("#000000", CustomThemePalette.normalizeHex("bad", "#000000"))
    }
}
