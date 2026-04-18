package com.fitgpt.app.navigation

internal enum class SessionBootstrapStatus {
    NO_TOKEN,
    VALID_PROFILE,
    INVALID_SESSION,
    PROFILE_UNAVAILABLE,
}

internal data class SessionBootstrapDecision(
    val route: String,
    val hasToken: Boolean,
    val shouldClearToken: Boolean,
    val shouldMarkOnboardingComplete: Boolean,
)

internal fun resolveSessionBootstrapDecision(
    hasStoredToken: Boolean,
    localOnboardingComplete: Boolean,
    remoteOnboardingComplete: Boolean? = null,
    status: SessionBootstrapStatus,
): SessionBootstrapDecision {
    if (!hasStoredToken || status == SessionBootstrapStatus.NO_TOKEN) {
        return SessionBootstrapDecision(
            route = Routes.LOGIN,
            hasToken = false,
            shouldClearToken = false,
            shouldMarkOnboardingComplete = false,
        )
    }

    if (status == SessionBootstrapStatus.INVALID_SESSION) {
        return SessionBootstrapDecision(
            route = Routes.LOGIN,
            hasToken = false,
            shouldClearToken = true,
            shouldMarkOnboardingComplete = false,
        )
    }

    val shouldMarkOnboardingComplete = remoteOnboardingComplete == true && !localOnboardingComplete
    val resolvedLocalOnboarding = localOnboardingComplete || shouldMarkOnboardingComplete
    val resolvedRemoteOnboarding = when (status) {
        SessionBootstrapStatus.VALID_PROFILE -> remoteOnboardingComplete
        SessionBootstrapStatus.PROFILE_UNAVAILABLE -> null
        else -> remoteOnboardingComplete
    }

    return SessionBootstrapDecision(
        route = resolveStartupRoute(
            hasValidSession = true,
            onboardingComplete = resolvedRemoteOnboarding,
            localOnboardingComplete = resolvedLocalOnboarding
        ),
        hasToken = true,
        shouldClearToken = false,
        shouldMarkOnboardingComplete = shouldMarkOnboardingComplete,
    )
}

internal fun resolveStartupRoute(
    hasValidSession: Boolean,
    onboardingComplete: Boolean?,
    localOnboardingComplete: Boolean = false
): String {
    if (!hasValidSession) {
        return Routes.LOGIN
    }
    val resolvedOnboardingComplete = onboardingComplete ?: localOnboardingComplete
    return if (!resolvedOnboardingComplete) {
        Routes.ONBOARDING_WELCOME
    } else {
        Routes.DASHBOARD
    }
}
