/**
 * Shared top-level scaffold with FitGPT branding, tab navigation, and animated background shell.
 */
package com.fitgpt.app.ui.common

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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.NavGraph.Companion.findStartDestination
import com.fitgpt.app.R
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
    showMoreAction: Boolean = true,
    showBottomBar: Boolean = true,
    floatingActionButton: @Composable (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val activeRoute = navBackStackEntry?.destination?.route ?: currentRoute
    val meshAccentDeep = LocalFitGptVisualTokens.current.meshAccentDeep

    Scaffold(
        topBar = {
            TopAppBar(
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
                    if (activeRoute != Routes.CHAT) {
                        IconButton(
                            onClick = {
                                navController.navigate(Routes.CHAT) {
                                    launchSingleTop = true
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = "Chat"
                            )
                        }
                    }
                    if (showMoreAction && activeRoute != Routes.MORE && activeRoute != Routes.SETTINGS) {
                        IconButton(
                            onClick = {
                                navController.navigate(Routes.MORE) {
                                    launchSingleTop = true
                                }
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
            if (showBottomBar) {
                NavigationBar(
                    containerColor = colorScheme.surface.copy(alpha = 0.95f),
                    tonalElevation = 8.dp
                ) {
                    topLevelItems.forEach { item ->
                        NavigationBarItem(
                            selected = activeRoute == item.route,
                            onClick = {
                                if (isTopLevelDestination(navBackStackEntry?.destination, item.route)) {
                                    navController.popBackStack(item.route, inclusive = false)
                                } else {
                                    navController.navigate(item.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
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

private fun isTopLevelDestination(destination: NavDestination?, route: String): Boolean {
    return destination?.hierarchy?.any { it.route == route } == true
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
