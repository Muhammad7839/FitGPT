package com.fitgpt.app.navigation

import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.onboarding.WelcomeScreen
import com.fitgpt.app.ui.recommendation.RecommendationScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen
import com.fitgpt.app.viewmodel.OnboardingViewModel
import com.fitgpt.app.viewmodel.OnboardingViewModelFactory
import com.fitgpt.app.viewmodel.WardrobeViewModel

object Routes {
    const val ONBOARDING_WELCOME = "onboarding_welcome"
    const val WARDROBE = "wardrobe"
    const val ADD_ITEM = "add_item"
    const val EDIT_ITEM = "edit_item"
    const val RECOMMENDATION = "recommendation"
}

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController()
) {
    val context = LocalContext.current
    val prefs = remember { PreferencesManager(context) }

    // -----------------------------
    // Onboarding ViewModel
    // -----------------------------
    val onboardingViewModel: OnboardingViewModel =
        viewModel(factory = OnboardingViewModelFactory(prefs))

    // -----------------------------
    // Shared Wardrobe ViewModel
    // -----------------------------
    val wardrobeViewModel: WardrobeViewModel = viewModel()

    // -----------------------------
    // DataStore loading gate
    // -----------------------------
    var isReady by remember { mutableStateOf(false) }
    var completed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        onboardingViewModel.completed.collect { value ->
            completed = value
            isReady = true
        }
    }

    if (!isReady) return

    val startDestination =
        if (completed) Routes.WARDROBE
        else Routes.ONBOARDING_WELCOME

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {

        composable(Routes.ONBOARDING_WELCOME) {
            WelcomeScreen(
                navController = navController,
                viewModel = onboardingViewModel
            )
        }

        composable(Routes.WARDROBE) {
            WardrobeScreen(
                navController = navController,
                viewModel = wardrobeViewModel
            )
        }

        composable(Routes.ADD_ITEM) {
            AddItemScreen(
                navController = navController,
                viewModel = wardrobeViewModel
            )
        }

        composable(
            route = "${Routes.EDIT_ITEM}/{itemId}",
            arguments = listOf(
                navArgument("itemId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val itemId = backStackEntry.arguments!!.getInt("itemId")
            EditItemScreen(
                navController = navController,
                itemId = itemId,
                viewModel = wardrobeViewModel
            )
        }

        composable(Routes.RECOMMENDATION) {
            RecommendationScreen(
                navController = navController,
                viewModel = wardrobeViewModel
            )
        }
    }
}