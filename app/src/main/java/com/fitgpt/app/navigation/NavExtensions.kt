/**
 * Shared navigation helpers for consistent top-level and secondary route behavior.
 */
package com.fitgpt.app.navigation

import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy

private val topLevelRoutes = setOf(
    Routes.DASHBOARD,
    Routes.WARDROBE,
    Routes.RECOMMENDATION,
    Routes.PROFILE
)

fun routeBase(route: String?): String {
    return route
        ?.substringBefore("?")
        ?.substringBefore("/")
        .orEmpty()
}

fun isTopLevelRoute(route: String?): Boolean {
    return topLevelRoutes.contains(routeBase(route))
}

fun NavDestination?.isInRouteHierarchy(route: String): Boolean {
    val target = routeBase(route)
    if (target.isEmpty()) return false
    return this?.hierarchy?.any { destination ->
        routeBase(destination.route) == target
    } == true
}

fun NavController.navigateToTopLevel(route: String) {
    val targetRoute = routeBase(route)
    if (targetRoute.isBlank()) return

    navigate(targetRoute) {
        // Pop to the graph root to avoid auth/onboarding-dependent start-destination edge cases.
        popUpTo(graph.id) {
            saveState = true
        }
        launchSingleTop = true
        restoreState = true
    }
}

fun NavController.navigateToSecondary(route: String) {
    navigate(route) {
        launchSingleTop = true
    }
}
