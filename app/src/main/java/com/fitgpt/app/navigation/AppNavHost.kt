package com.fitgpt.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.vectorResource
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fitgpt.app.R
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.chat.ChatScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.recommendation.RecommendationScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen
import com.fitgpt.app.viewmodel.ChatViewModel
import com.fitgpt.app.viewmodel.WardrobeViewModel

object Routes {
    const val WARDROBE = "wardrobe"
    const val ADD_ITEM = "add_item"
    const val EDIT_ITEM = "edit_item"
    const val RECOMMENDATIONS = "recommendations"
    const val CHAT = "chat"
}

private data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector
)

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController()
) {
    val wardrobeViewModel: WardrobeViewModel = viewModel()
    val chatViewModel: ChatViewModel = viewModel()

    // Keep chat wardrobe context in sync
    val wardrobeItems by wardrobeViewModel.wardrobeItems.collectAsState()
    val userPreferences by wardrobeViewModel.userPreferences.collectAsState()
    LaunchedEffect(wardrobeItems, userPreferences) {
        chatViewModel.updateWardrobeContext(wardrobeItems, userPreferences)
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Only show bottom bar on the two main tabs
    val showBottomBar = currentRoute == Routes.WARDROBE || currentRoute == Routes.CHAT

    val bottomNavItems = listOf(
        BottomNavItem(Routes.WARDROBE, "Wardrobe", ImageVector.vectorResource(R.drawable.ic_wardrobe)),
        BottomNavItem(Routes.CHAT, "Chat", Icons.Default.Email)
    )

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.route,
                            onClick = {
                                if (currentRoute != item.route) {
                                    navController.navigate(item.route) {
                                        popUpTo(Routes.WARDROBE) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.WARDROBE,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(route = Routes.WARDROBE) {
                WardrobeScreen(
                    navController = navController,
                    viewModel = wardrobeViewModel
                )
            }

            composable(route = Routes.ADD_ITEM) {
                AddItemScreen(
                    navController = navController,
                    viewModel = wardrobeViewModel
                )
            }

            composable(route = Routes.RECOMMENDATIONS) {
                RecommendationScreen(
                    navController = navController,
                    viewModel = wardrobeViewModel
                )
            }

            composable(
                route = "${Routes.EDIT_ITEM}/{itemId}",
                arguments = listOf(
                    navArgument("itemId") {
                        type = NavType.IntType
                    }
                )
            ) { backStackEntry ->
                val itemId = backStackEntry.arguments!!.getInt("itemId")
                EditItemScreen(
                    navController = navController,
                    itemId = itemId,
                    viewModel = wardrobeViewModel
                )
            }

            composable(route = Routes.CHAT) {
                ChatScreen(viewModel = chatViewModel)
            }
        }
    }
}
