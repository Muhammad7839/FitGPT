/**
 * Unit tests for top-level tab visit/back-target behavior.
 */
package com.fitgpt.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TopLevelTabHistoryTest {
    @Test
    fun resolveBackTarget_walksBackThroughVisitedTopLevelTabs() {
        val history = TopLevelTabHistory(homeRoute = Routes.DASHBOARD)
        history.recordVisit(Routes.DASHBOARD)
        history.recordVisit(Routes.WARDROBE)
        history.recordVisit(Routes.PROFILE)

        assertEquals(Routes.WARDROBE, history.resolveBackTarget(Routes.PROFILE))
        assertEquals(Routes.DASHBOARD, history.resolveBackTarget(Routes.WARDROBE))
        assertNull(history.resolveBackTarget(Routes.DASHBOARD))
    }

    @Test
    fun resolveBackTarget_defaultsToHomeWhenOnlyNonHomeTopLevelVisited() {
        val history = TopLevelTabHistory(homeRoute = Routes.DASHBOARD)
        history.recordVisit(Routes.RECOMMENDATION)

        assertEquals(Routes.DASHBOARD, history.resolveBackTarget(Routes.RECOMMENDATION))
        history.recordVisit(Routes.DASHBOARD)
        assertEquals(Routes.RECOMMENDATION, history.resolveBackTarget(Routes.DASHBOARD))
    }

    @Test
    fun recordVisit_keepsOrderWithoutDuplicates() {
        val history = TopLevelTabHistory(homeRoute = Routes.DASHBOARD)
        history.recordVisit(Routes.DASHBOARD)
        history.recordVisit(Routes.WARDROBE)
        history.recordVisit(Routes.DASHBOARD)
        history.recordVisit(Routes.RECOMMENDATION)

        assertEquals(
            listOf(Routes.WARDROBE, Routes.DASHBOARD, Routes.RECOMMENDATION),
            history.snapshot()
        )
    }
}
