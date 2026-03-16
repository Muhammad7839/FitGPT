/**
 * Shared top-level scaffold with FitGPT branding, tab navigation, and animated background shell.
 */
package com.fitgpt.app.ui.common

import android.os.SystemClock
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.fitgpt.app.R
import com.fitgpt.app.navigation.isInRouteHierarchy
import com.fitgpt.app.navigation.isTopLevelRoute
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.navigation.navigateToTopLevel
import com.fitgpt.app.navigation.routeBase
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.theme.LocalFitGptVisualTokens

/**
 * Shared shell used by top-level screens to mirror the web app IA.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun FitGptScaffold(
    navController: NavController,
    currentRoute: String,
    title: String,
    showChatAction: Boolean = true,
    showMoreAction: Boolean = true,
    showBottomBar: Boolean = true,
    showBackButton: Boolean? = null,
    onBackClick: (() -> Unit)? = null,
    snackbarHost: @Composable (() -> Unit)? = null,
    floatingActionButton: @Composable (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val activeRoute = navBackStackEntry?.destination?.route ?: currentRoute
    val activeRouteBase = routeBase(activeRoute)
    val shouldShowBottomBar = showBottomBar && isTopLevelRoute(activeRouteBase)
    val shouldShowBackButton = showBackButton ?: !isTopLevelRoute(activeRouteBase)
    val meshAccentDeep = LocalFitGptVisualTokens.current.meshAccentDeep
    var lastTabTapRoute by remember { mutableStateOf<String?>(null) }
    var lastTabTapAt by remember { mutableLongStateOf(0L) }

    Scaffold(
        snackbarHost = {
            if (snackbarHost != null) {
                snackbarHost()
            }
        },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    if (shouldShowBackButton) {
                        IconButton(
                            onClick = {
                                if (onBackClick != null) {
                                    onBackClick()
                                } else if (!navController.popBackStack()) {
                                    navController.navigateToTopLevel(Routes.DASHBOARD)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back"
                            )
                        }
                    }
                },
                title = {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .shadow(8.dp, RoundedCornerShape(12.dp))
                                .clip(RoundedCornerShape(12.dp))
                                .padding(2.dp)
                        )
                        {
                            Image(
                                painter = painterResource(id = R.drawable.official_logo),
                                contentDescription = "FitGPT",
                                modifier = Modifier.size(28.dp)
                            )
                        }
                        Text(title)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = colorScheme.surface.copy(alpha = 0.94f),
                    titleContentColor = colorScheme.onSurface
                ),
                actions = {
                    if (showChatAction && activeRouteBase != Routes.CHAT) {
                        IconButton(
                            onClick = {
                                navController.navigateToSecondary(Routes.CHAT)
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = "Chat"
                            )
                        }
                    }
                    if (showMoreAction && activeRouteBase != Routes.MORE && activeRouteBase != Routes.SETTINGS) {
                        IconButton(
                            onClick = {
                                navController.navigateToSecondary(Routes.MORE)
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More"
                            )
                        }
                    }
                },
                modifier = Modifier.statusBarsPadding()
            )
        },
        bottomBar = {
            if (shouldShowBottomBar) {
                NavigationBar(
                    containerColor = colorScheme.surface.copy(alpha = 0.95f),
                    tonalElevation = 8.dp
                ) {
                    topLevelItems.forEach { item ->
                        val isSelected = routeBase(activeRoute) == item.route
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = {
                                if (isSelected || navBackStackEntry?.destination.isInRouteHierarchy(item.route)) {
                                    val popped = navController.popBackStack(item.route, inclusive = false)
                                    if (!popped) {
                                        val now = SystemClock.elapsedRealtime()
                                        val shouldTriggerReselectAction =
                                            lastTabTapRoute == item.route && (now - lastTabTapAt) <= 1200L
                                        lastTabTapRoute = item.route
                                        lastTabTapAt = now
                                        if (shouldTriggerReselectAction) {
                                            TopLevelReselectBus.dispatch(item.route)
                                        }
                                    } else {
                                        lastTabTapRoute = item.route
                                        lastTabTapAt = SystemClock.elapsedRealtime()
                                    }
                                } else {
                                    lastTabTapRoute = item.route
                                    lastTabTapAt = SystemClock.elapsedRealtime()
                                    navController.navigateToTopLevel(item.route)
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = colorScheme.primary,
                                selectedTextColor = colorScheme.primary,
                                indicatorColor = colorScheme.primary.copy(alpha = 0.14f),
                                unselectedIconColor = colorScheme.onSurfaceVariant,
                                unselectedTextColor = colorScheme.onSurfaceVariant
                            )
                        )
                    }
                }
            }
        },
        floatingActionButton = { floatingActionButton?.invoke() }
    ) { padding ->
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            AnimatedMeshBackground(
                backgroundTop = colorScheme.background,
                backgroundBottom = colorScheme.surfaceVariant.copy(alpha = 0.84f),
                accent = colorScheme.primary,
                accentSoft = colorScheme.primary.copy(alpha = 0.8f),
                accentDeep = meshAccentDeep
            )
            Box(modifier = Modifier.fillMaxSize()) { content(padding) }
        }
    }
}

private data class TopLevelNavItem(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
)

private val topLevelItems = listOf(
    TopLevelNavItem(Routes.DASHBOARD, "Home", Icons.Default.Home),
    TopLevelNavItem(Routes.WARDROBE, "Wardrobe", Icons.AutoMirrored.Filled.List),
    TopLevelNavItem(Routes.RECOMMENDATION, "Recommend", Icons.Default.Star),
    TopLevelNavItem(Routes.PROFILE, "Profile", Icons.Default.Person)
)
