package com.fitgpt.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.auth.LoginScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen
import com.fitgpt.app.viewmodel.AuthViewModel
import com.fitgpt.app.viewmodel.WardrobeViewModel

object Routes {
    const val LOGIN = "login"
    const val WARDROBE = "wardrobe"
    const val ADD_ITEM = "add_item"
    const val EDIT_ITEM = "edit_item"
}

@Composable
fun AppNavHost(
    wardrobeViewModel: WardrobeViewModel,
    authViewModel: AuthViewModel,
    hasToken: Boolean,
    navController: NavHostController = rememberNavController()
) {
    val startDestination = if (hasToken) Routes.WARDROBE else Routes.LOGIN

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {

        composable(route = Routes.LOGIN) {
            LoginScreen(
                authViewModel = authViewModel,
                onAuthenticated = {
                    wardrobeViewModel.loadItems()
                    navController.navigate(Routes.WARDROBE) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

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
    }
}
