package com.fitgpt.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class RoutesTest {
    @Test
    fun chatRoute_isAvailableFromNavigationConstants() {
        assertEquals("chat", Routes.CHAT)
        assertEquals("more", Routes.MORE)
    }
}
