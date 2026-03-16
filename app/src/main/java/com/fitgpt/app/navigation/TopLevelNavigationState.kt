/**
 * Shared state utilities for top-level tab reselection behavior and back navigation policy.
 */
package com.fitgpt.app.navigation

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Tracks top-level tab visit order so back can return to prior tabs before exit.
 */
class TopLevelTabHistory(
    private val homeRoute: String = Routes.DASHBOARD
) {
    private val history = mutableListOf<String>()

    fun clear() {
        history.clear()
    }

    fun recordVisit(route: String?) {
        val base = routeBase(route)
        if (!isTopLevelRoute(base)) return
        history.remove(base)
        history.add(base)
    }

    /**
     * Returns the next top-level route for back navigation.
     * Returns null when app should consider exit behavior.
     */
    fun resolveBackTarget(currentRoute: String?): String? {
        val base = routeBase(currentRoute)
        if (!isTopLevelRoute(base)) return null

        if (history.lastOrNull() != base) {
            history.remove(base)
            history.add(base)
        }

        if (history.size > 1) {
            history.removeAt(history.lastIndex)
            return history.last()
        }
        return if (base != homeRoute) homeRoute else null
    }

    fun snapshot(): List<String> = history.toList()
}

/**
 * Emits top-level tab reselection events for per-screen refresh/scroll behavior.
 */
object TopLevelReselectBus {
    private val _events = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val events: SharedFlow<String> = _events.asSharedFlow()

    fun dispatch(route: String) {
        val base = routeBase(route)
        if (base.isNotBlank()) {
            _events.tryEmit(base)
        }
    }
}
