/**
 * Shared navigation helpers for consistent top-level and secondary route behavior.
 */
package com.fitgpt.app.navigation

import android.util.Log
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination

private const val NAV_LOG_TAG = "FitGPTNav"

private val topLevelRoutes = setOf(
    Routes.DASHBOARD,
    Routes.WARDROBE,
    Routes.HISTORY,
    Routes.PLANS,
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
    val currentRoute = routeBase(currentDestination?.route)
    val isReselect = currentRoute == targetRoute

    Log.i(
        NAV_LOG_TAG,
        "navigateToTopLevel target=$targetRoute current=$currentRoute reselect=$isReselect"
    )
    if (targetRoute == Routes.WARDROBE) {
        Log.i(NAV_LOG_TAG, "Navigating to wardrobe")
    }
    Log.i(NAV_LOG_TAG, "Current route: $currentRoute")

    navigate(targetRoute) {
        popUpTo(graph.findStartDestination().id) {
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
