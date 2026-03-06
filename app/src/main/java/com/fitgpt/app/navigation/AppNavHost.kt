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
import com.fitgpt.app.di.ServiceLocator
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.auth.LoginScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.onboarding.WelcomeScreen
import com.fitgpt.app.ui.recommendation.RecommendationScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen
import com.fitgpt.app.viewmodel.AuthViewModel
import com.fitgpt.app.viewmodel.AuthViewModelFactory
import com.fitgpt.app.viewmodel.OnboardingViewModel
import com.fitgpt.app.viewmodel.OnboardingViewModelFactory
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WardrobeViewModelFactory

object Routes {
    const val ONBOARDING_WELCOME = "onboarding_welcome"
    const val LOGIN = "login"
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
    val tokenStore = remember { ServiceLocator.provideTokenStore(context) }

    // -----------------------------
    // Onboarding ViewModel
    // -----------------------------
    val onboardingViewModel: OnboardingViewModel =
        viewModel(factory = OnboardingViewModelFactory(prefs))

    // -----------------------------
    // DataStore loading gate
    // -----------------------------
    var isReady by remember { mutableStateOf(false) }
    var completed by remember { mutableStateOf(false) }
    var authReady by remember { mutableStateOf(false) }
    var hasToken by remember { mutableStateOf(false) }

    // -----------------------------
    // Shared Wardrobe ViewModel
    // -----------------------------
    val wardrobeRepository = remember { ServiceLocator.provideWardrobeRepository(context) }
    val wardrobeViewModel: WardrobeViewModel? =
        if (hasToken) {
            viewModel(factory = WardrobeViewModelFactory(wardrobeRepository))
        } else {
            null
        }
    val authRepository = remember { ServiceLocator.provideAuthRepository(context) }
    val authViewModel: AuthViewModel =
        viewModel(factory = AuthViewModelFactory(authRepository, tokenStore))

    LaunchedEffect(Unit) {
        onboardingViewModel.completed.collect { value ->
            completed = value
            isReady = true
        }
    }

    LaunchedEffect(Unit) {
        val token = tokenStore.getAccessToken()
        if (token.isNullOrBlank()) {
            hasToken = false
        } else {
            hasToken = authRepository.hasValidSession()
            if (!hasToken) {
                tokenStore.clearToken()
            }
        }
        authReady = true
    }

    if (!isReady || !authReady) return

    val startDestination =
        if (!completed) Routes.ONBOARDING_WELCOME
        else if (hasToken) Routes.WARDROBE
        else Routes.LOGIN

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

        composable(Routes.LOGIN) {
            LoginScreen(
                viewModel = authViewModel,
                onLoginSuccess = {
                    hasToken = true
                    navController.navigate(Routes.WARDROBE) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.WARDROBE) {
            val vm = wardrobeViewModel ?: return@composable
            WardrobeScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.ADD_ITEM) {
            val vm = wardrobeViewModel ?: return@composable
            AddItemScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(
            route = "${Routes.EDIT_ITEM}/{itemId}",
            arguments = listOf(
                navArgument("itemId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val vm = wardrobeViewModel ?: return@composable
            val itemId = backStackEntry.arguments!!.getInt("itemId")
            EditItemScreen(
                navController = navController,
                itemId = itemId,
                viewModel = vm
            )
        }

        composable(Routes.RECOMMENDATION) {
            val vm = wardrobeViewModel ?: return@composable
            RecommendationScreen(
                navController = navController,
                viewModel = vm
            )
        }
    }
}
