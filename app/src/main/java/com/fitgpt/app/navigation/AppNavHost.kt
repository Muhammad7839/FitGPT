package com.fitgpt.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.recommendation.RecommendationScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen

object Routes {
    const val WARDROBE = "wardrobe"
    const val ADD_ITEM = "add_item"
    const val EDIT_ITEM = "edit_item"
    const val RECOMMENDATIONS = "recommendations"
}

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Routes.WARDROBE
    ) {

        composable(route = Routes.WARDROBE) {
            WardrobeScreen(navController = navController)
        }

        composable(route = Routes.ADD_ITEM) {
            AddItemScreen(navController = navController)
        }

        composable(route = Routes.RECOMMENDATIONS) {
            RecommendationScreen(navController = navController)
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
                itemId = itemId
            )
        }
    }
}