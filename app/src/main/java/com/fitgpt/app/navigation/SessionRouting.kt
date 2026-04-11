package com.fitgpt.app.navigation

internal fun resolveStartupRoute(
    hasValidSession: Boolean,
    onboardingComplete: Boolean?
): String {
    if (!hasValidSession) {
        return Routes.LOGIN
    }
    return if (onboardingComplete == false) {
        Routes.ONBOARDING_WELCOME
    } else {
        Routes.DASHBOARD
    }
}

