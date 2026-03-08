package com.fitgpt.app.ui.common

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.R
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.theme.FitgptAccentDeep

/**
 * Shared shell used by top-level screens to mirror the web app IA.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun FitGptScaffold(
    navController: NavController,
    currentRoute: String,
    title: String,
    floatingActionButton: @Composable (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    val colorScheme = MaterialTheme.colorScheme
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
                modifier = Modifier.statusBarsPadding()
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = colorScheme.surface.copy(alpha = 0.95f),
                tonalElevation = 8.dp
            ) {
                topLevelItems.forEach { item ->
                    NavigationBarItem(
                        selected = currentRoute == item.route,
                        onClick = {
                            if (currentRoute != item.route) {
                                navController.navigate(item.route) {
                                    popUpTo(Routes.DASHBOARD)
                                    launchSingleTop = true
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
                accentDeep = FitgptAccentDeep
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(0.dp))
            ) {
                AnimatedContent(
                    targetState = currentRoute,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "route-fade"
                ) {
                    content(padding)
                }
            }
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
    TopLevelNavItem(Routes.FAVORITES, "Favorites", Icons.Default.Favorite),
    TopLevelNavItem(Routes.SAVED_OUTFITS, "Saved", Icons.Default.Star),
    TopLevelNavItem(Routes.HISTORY, "History", Icons.Default.Info),
    TopLevelNavItem(Routes.PLANS, "Plans", Icons.Default.DateRange),
    TopLevelNavItem(Routes.PROFILE, "Profile", Icons.Default.Person)
)
