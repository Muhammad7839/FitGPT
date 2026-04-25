package com.fitgpt.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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

    @Test
    fun resolveStartupRoute_usesLocalOnboardingStateWhenRemoteCheckIsUnavailable() {
        assertEquals(
            Routes.DASHBOARD,
            resolveStartupRoute(
                hasValidSession = true,
                onboardingComplete = null,
                localOnboardingComplete = true
            )
        )
    }

    @Test
    fun resolveStartupRoute_defaultsToOnboardingWhenRemoteCheckIsUnavailableAndLocalIsIncomplete() {
        assertEquals(
            Routes.ONBOARDING_WELCOME,
            resolveStartupRoute(
                hasValidSession = true,
                onboardingComplete = null,
                localOnboardingComplete = false
            )
        )
    }

    @Test
    fun resolveSessionBootstrapDecision_clearsSessionWhenStoredTokenIsRejected() {
        val decision = resolveSessionBootstrapDecision(
            hasStoredToken = true,
            localOnboardingComplete = true,
            status = SessionBootstrapStatus.INVALID_SESSION
        )

        assertEquals(Routes.LOGIN, decision.route)
        assertFalse(decision.hasToken)
        assertTrue(decision.shouldClearToken)
        assertFalse(decision.shouldMarkOnboardingComplete)
    }

    @Test
    fun resolveSessionBootstrapDecision_keepsUserSignedInWhenProfileCheckIsUnavailable() {
        val decision = resolveSessionBootstrapDecision(
            hasStoredToken = true,
            localOnboardingComplete = true,
            status = SessionBootstrapStatus.PROFILE_UNAVAILABLE
        )

        assertEquals(Routes.DASHBOARD, decision.route)
        assertTrue(decision.hasToken)
        assertFalse(decision.shouldClearToken)
        assertFalse(decision.shouldMarkOnboardingComplete)
    }

    @Test
    fun resolveSessionBootstrapDecision_marksLocalOnboardingWhenRemoteProfileIsComplete() {
        val decision = resolveSessionBootstrapDecision(
            hasStoredToken = true,
            localOnboardingComplete = false,
            remoteOnboardingComplete = true,
            status = SessionBootstrapStatus.VALID_PROFILE
        )

        assertEquals(Routes.DASHBOARD, decision.route)
        assertTrue(decision.hasToken)
        assertFalse(decision.shouldClearToken)
        assertTrue(decision.shouldMarkOnboardingComplete)
    }
}
