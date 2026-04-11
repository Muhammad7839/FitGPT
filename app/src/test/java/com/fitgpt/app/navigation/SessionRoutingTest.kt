package com.fitgpt.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class SessionRoutingTest {

    @Test
    fun resolveStartupRoute_returnsLoginWhenSessionIsMissing() {
        assertEquals(
            Routes.LOGIN,
            resolveStartupRoute(hasValidSession = false, onboardingComplete = null)
        )
    }

    @Test
    fun resolveStartupRoute_returnsOnboardingWhenAuthenticatedUserIsIncomplete() {
        assertEquals(
            Routes.ONBOARDING_WELCOME,
            resolveStartupRoute(hasValidSession = true, onboardingComplete = false)
        )
    }

    @Test
    fun resolveStartupRoute_returnsDashboardWhenAuthenticatedUserIsComplete() {
        assertEquals(
            Routes.DASHBOARD,
            resolveStartupRoute(hasValidSession = true, onboardingComplete = true)
        )
    }
}
