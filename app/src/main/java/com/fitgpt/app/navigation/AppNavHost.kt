/**
 * App navigation graph and startup routing decisions (onboarding, auth, wardrobe).
 */
package com.fitgpt.app.navigation

import android.app.Activity
import android.os.SystemClock
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.core.tween
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.fitgpt.app.data.PreferencesManager
import com.fitgpt.app.di.ServiceLocator
import com.fitgpt.app.ui.additem.AddItemScreen
import com.fitgpt.app.ui.auth.ForgotPasswordScreen
import com.fitgpt.app.ui.auth.LoginScreen
import com.fitgpt.app.ui.auth.ResetPasswordScreen
import com.fitgpt.app.ui.auth.SignupScreen
import com.fitgpt.app.ui.chat.ChatScreen
import com.fitgpt.app.ui.dashboard.DashboardScreen
import com.fitgpt.app.ui.edititem.EditItemScreen
import com.fitgpt.app.ui.favorites.FavoritesScreen
import com.fitgpt.app.ui.history.HistoryScreen
import com.fitgpt.app.ui.more.MoreScreen
import com.fitgpt.app.ui.onboarding.PostLoginTutorialScreen
import com.fitgpt.app.ui.onboarding.WelcomeScreen
import com.fitgpt.app.ui.plans.PlansScreen
import com.fitgpt.app.ui.profile.ProfileScreen
import com.fitgpt.app.ui.recommendation.RecommendationScreen
import com.fitgpt.app.ui.saved.SavedOutfitsScreen
import com.fitgpt.app.ui.settings.SettingsScreen
import com.fitgpt.app.ui.wardrobe.WardrobeScreen
import com.fitgpt.app.viewmodel.AuthViewModel
import com.fitgpt.app.viewmodel.AuthViewModelFactory
import com.fitgpt.app.viewmodel.ChatViewModel
import com.fitgpt.app.viewmodel.ChatViewModelFactory
import com.fitgpt.app.viewmodel.OnboardingViewModel
import com.fitgpt.app.viewmodel.OnboardingViewModelFactory
import com.fitgpt.app.viewmodel.ProfileViewModel
import com.fitgpt.app.viewmodel.ProfileViewModelFactory
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WardrobeViewModelFactory
import kotlinx.coroutines.launch

private const val NAV_LOG_TAG = "FitGPTNav"

object Routes {
    const val ONBOARDING_WELCOME = "onboarding_welcome"
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val FORGOT_PASSWORD = "forgot_password"
    const val RESET_PASSWORD = "reset_password"
    const val RESET_PASSWORD_ROUTE = "reset_password?token={token}"
    const val POST_LOGIN_TUTORIAL = "post_login_tutorial"
    const val DASHBOARD = "dashboard"
    const val WARDROBE = "wardrobe"
    const val FAVORITES = "favorites"
    const val SAVED_OUTFITS = "saved_outfits"
    const val HISTORY = "history"
    const val PLANS = "plans"
    const val PROFILE = "profile"
    const val MORE = "more"
    const val SETTINGS = "settings"
    const val CHAT = "chat"
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
    val appScope = rememberCoroutineScope()
    val tokenStore = remember { ServiceLocator.provideTokenStore(context) }

    val onboardingViewModel: OnboardingViewModel =
        viewModel(factory = OnboardingViewModelFactory(prefs))

    var isReady by remember { mutableStateOf(false) }
    var completed by remember { mutableStateOf(false) }
    var authReady by remember { mutableStateOf(false) }
    var hasToken by remember { mutableStateOf(false) }
    var tutorialReady by remember { mutableStateOf(false) }
    var tutorialCompleted by remember { mutableStateOf(false) }

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
    val profileRepository = remember { ServiceLocator.provideProfileRepository(context) }
    val profileViewModel: ProfileViewModel? =
        if (hasToken) {
            viewModel(factory = ProfileViewModelFactory(profileRepository))
        } else {
            null
        }
    val chatRepository = remember { ServiceLocator.provideChatRepository(context) }
    val chatViewModel: ChatViewModel? =
        if (hasToken) {
            viewModel(factory = ChatViewModelFactory(chatRepository))
        } else {
            null
        }

    DisposableEffect(navController) {
        val listener = androidx.navigation.NavController.OnDestinationChangedListener { _, destination, _ ->
            Log.i(NAV_LOG_TAG, "route=${destination.route}")
        }
        navController.addOnDestinationChangedListener(listener)
        onDispose {
            navController.removeOnDestinationChangedListener(listener)
        }
    }

    LaunchedEffect(Unit) {
        // Start route waits until onboarding completion and auth validity are known.
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

    LaunchedEffect(Unit) {
        prefs.tutorialCompleted.collect { completedTutorial ->
            tutorialCompleted = completedTutorial
            tutorialReady = true
        }
    }

    if (!isReady || !authReady || !tutorialReady) return

    val startDestination =
        if (!completed) Routes.ONBOARDING_WELCOME
        else if (hasToken && !tutorialCompleted) Routes.POST_LOGIN_TUTORIAL
        else if (hasToken) Routes.DASHBOARD
        else Routes.LOGIN
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRouteBase = routeBase(currentBackStackEntry?.destination?.route)
    val topLevelTabHistory = remember { TopLevelTabHistory(homeRoute = Routes.DASHBOARD) }
    var lastBackPressAt by remember { mutableLongStateOf(0L) }

    LaunchedEffect(hasToken) {
        if (!hasToken) {
            topLevelTabHistory.clear()
            lastBackPressAt = 0L
        }
    }

    LaunchedEffect(hasToken, currentRouteBase) {
        if (hasToken) {
            topLevelTabHistory.recordVisit(currentRouteBase)
        }
    }

    BackHandler(enabled = hasToken && isTopLevelRoute(currentRouteBase)) {
        val backTarget = topLevelTabHistory.resolveBackTarget(currentRouteBase)
        if (backTarget != null) {
            navController.navigateToTopLevel(backTarget)
            return@BackHandler
        }

        val now = SystemClock.elapsedRealtime()
        if (now - lastBackPressAt <= 2000L) {
            (context as? Activity)?.finish()
        } else {
            lastBackPressAt = now
            Toast.makeText(context, "Press back again to exit", Toast.LENGTH_SHORT).show()
        }
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = {
            slideInHorizontally(
                initialOffsetX = { width -> width / 8 },
                animationSpec = tween(220)
            ) + fadeIn(animationSpec = tween(220))
        },
        exitTransition = {
            slideOutHorizontally(
                targetOffsetX = { width -> -(width / 10) },
                animationSpec = tween(180)
            ) + fadeOut(animationSpec = tween(180))
        },
        popEnterTransition = {
            slideInHorizontally(
                initialOffsetX = { width -> -(width / 8) },
                animationSpec = tween(220)
            ) + fadeIn(animationSpec = tween(220))
        },
        popExitTransition = {
            slideOutHorizontally(
                targetOffsetX = { width -> width / 10 },
                animationSpec = tween(180)
            ) + fadeOut(animationSpec = tween(180))
        }
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
                    val target = if (tutorialCompleted) Routes.DASHBOARD else Routes.POST_LOGIN_TUTORIAL
                    navController.navigate(target) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onCreateAccountClick = {
                    navController.navigate(Routes.SIGNUP)
                },
                onForgotPasswordClick = {
                    navController.navigate(Routes.FORGOT_PASSWORD)
                }
            )
        }

        composable(Routes.SIGNUP) {
            SignupScreen(
                viewModel = authViewModel,
                onSignupSuccess = {
                    hasToken = true
                    val target = if (tutorialCompleted) Routes.DASHBOARD else Routes.POST_LOGIN_TUTORIAL
                    navController.navigate(target) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                onBackToLoginClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(Routes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                navController = navController,
                viewModel = authViewModel
            )
        }

        composable(
            route = Routes.RESET_PASSWORD_ROUTE,
            arguments = listOf(
                navArgument("token") {
                    type = NavType.StringType
                    defaultValue = ""
                    nullable = true
                }
            )
        ) { backStackEntry ->
            ResetPasswordScreen(
                navController = navController,
                viewModel = authViewModel,
                initialToken = backStackEntry.arguments?.getString("token").orEmpty()
            )
        }

        composable(Routes.POST_LOGIN_TUTORIAL) {
            PostLoginTutorialScreen(
                onComplete = {
                    if (!tutorialCompleted) {
                        appScope.launch {
                            prefs.markTutorialSeen()
                        }
                    }
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.POST_LOGIN_TUTORIAL) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.DASHBOARD) {
            val vm = wardrobeViewModel ?: return@composable
            DashboardScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.WARDROBE) {
            val vm = wardrobeViewModel ?: return@composable
            WardrobeScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.FAVORITES) {
            val vm = wardrobeViewModel ?: return@composable
            FavoritesScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.SAVED_OUTFITS) {
            val vm = wardrobeViewModel ?: return@composable
            SavedOutfitsScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.HISTORY) {
            val vm = wardrobeViewModel ?: return@composable
            HistoryScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.PLANS) {
            val vm = wardrobeViewModel ?: return@composable
            PlansScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.PROFILE) {
            val vm = profileViewModel ?: return@composable
            ProfileScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.MORE) {
            MoreScreen(navController = navController)
        }

        composable(Routes.CHAT) {
            val vm = chatViewModel ?: return@composable
            ChatScreen(
                navController = navController,
                viewModel = vm
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(navController = navController)
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
