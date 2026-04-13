/**
 * Shared top-level scaffold with FitGPT branding, reliable tab behavior, and contextual backgrounds.
 */
package com.fitgpt.app.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.ExtendedFloatingActionButton
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.fitgpt.app.R
import com.fitgpt.app.navigation.isTopLevelRoute
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.navigation.navigateToTopLevel
import com.fitgpt.app.navigation.routeBase
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.navigation.Routes

/**
 * Shared shell used by top-level screens to mirror the web app IA.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun FitGptScaffold(
    navController: NavController,
    currentRoute: String,
    title: String,
    showChatAction: Boolean = false,
    showMoreAction: Boolean = true,
    showBottomBar: Boolean = true,
    showBackButton: Boolean? = null,
    showGlobalChatFab: Boolean = true,
    onBackClick: (() -> Unit)? = null,
    snackbarHost: @Composable (() -> Unit)? = null,
    floatingActionButton: @Composable (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    val density = LocalDensity.current
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val activeRoute = navBackStackEntry?.destination?.route ?: currentRoute
    val activeRouteBase = routeBase(activeRoute)
    val shouldShowBottomBar = showBottomBar && isTopLevelRoute(activeRouteBase)
    val shouldShowBackButton = showBackButton ?: !isTopLevelRoute(activeRouteBase)
    val shouldShowGlobalChatFab = showGlobalChatFab && activeRouteBase == Routes.DASHBOARD
    val shouldShowBrandedBackground = isTopLevelRoute(activeRouteBase)
    val hasCustomFab = floatingActionButton != null

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
                                .background(colorScheme.surface.copy(alpha = 0.42f), RoundedCornerShape(12.dp))
                                .border(
                                    width = 1.dp,
                                    color = colorScheme.primary.copy(alpha = 0.22f),
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .drawBehind {
                                    val strokeWidth = 1.5.dp.toPx()
                                    drawRoundRect(
                                        color = colorScheme.primary.copy(alpha = 0.55f),
                                        cornerRadius = CornerRadius(12.dp.toPx(), 12.dp.toPx()),
                                        style = Stroke(
                                            width = strokeWidth,
                                            cap = StrokeCap.Round,
                                            pathEffect = PathEffect.dashPathEffect(
                                                floatArrayOf(8.dp.toPx(), 6.dp.toPx())
                                            )
                                        )
                                    )
                                }
                                .padding(4.dp)
                        )
                        {
                            Image(
                                painter = painterResource(id = R.drawable.fitgpt_header_logo),
                                contentDescription = "FitGPT",
                                modifier = Modifier.size(30.dp)
                            )
                        }
                        Text(title)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = colorScheme.surface.copy(alpha = 0.64f),
                    titleContentColor = colorScheme.onSurface
                ),
                actions = {
                    // Keep overflow focused on secondary utilities; primary AI chat access is via global FAB.
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
                    containerColor = colorScheme.surface.copy(alpha = 0.66f),
                    tonalElevation = 8.dp
                ) {
                    topLevelItems.forEach { item ->
                        val isSelected = activeRouteBase == item.route
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = {
                                if (isSelected) {
                                    TopLevelReselectBus.dispatch(item.route)
                                } else {
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
        floatingActionButton = {
            if (hasCustomFab || shouldShowGlobalChatFab) {
                Column(
                    modifier = Modifier.navigationBarsPadding(),
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    floatingActionButton?.invoke()
                    if (shouldShowGlobalChatFab && activeRouteBase != Routes.CHAT) {
                        ExtendedFloatingActionButton(
                            onClick = { navController.navigateToSecondary(Routes.CHAT) },
                            icon = {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = "AURA"
                                )
                            },
                            text = { Text("AURA") }
                        )
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            if (shouldShowBrandedBackground) {
                BrandingBackgroundLayer(logoOpacity = 0.06f)
            } else {
                Box(modifier = Modifier.fillMaxSize())
            }
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
    TopLevelNavItem(Routes.HISTORY, "Insights", Icons.Default.Info),
    TopLevelNavItem(Routes.PLANS, "Plans", Icons.Default.DateRange),
    TopLevelNavItem(Routes.PROFILE, "Profile", Icons.Default.Person)
)
