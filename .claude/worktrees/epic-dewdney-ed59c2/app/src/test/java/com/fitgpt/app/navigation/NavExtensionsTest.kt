/**
 * Unit tests for pure navigation route helper behavior.
 */
package com.fitgpt.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NavExtensionsTest {
    @Test
    fun routeBase_stripsPathAndQuerySegments() {
        assertEquals("recommendation", routeBase("recommendation"))
        assertEquals("edit_item", routeBase("edit_item/12"))
        assertEquals("reset_password", routeBase("reset_password?token=abc"))
    }

    @Test
    fun isTopLevelRoute_matchesOnlyPrimaryTabs() {
        assertTrue(isTopLevelRoute(Routes.DASHBOARD))
        assertTrue(isTopLevelRoute(Routes.WARDROBE))
        assertTrue(isTopLevelRoute(Routes.HISTORY))
        assertTrue(isTopLevelRoute(Routes.PLANS))
        assertTrue(isTopLevelRoute(Routes.PROFILE))
        assertFalse(isTopLevelRoute(Routes.MORE))
        assertFalse(isTopLevelRoute("${Routes.EDIT_ITEM}/21"))
    }
}
