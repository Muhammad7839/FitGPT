/**
 * Instrumentation tests for top-level tab behavior and scaffold navigation affordances.
 */
package com.fitgpt.app.ui.common

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.TopLevelReselectBus
import com.fitgpt.app.navigation.navigateToSecondary
import kotlinx.coroutines.flow.collectLatest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FitGptScaffoldNavigationTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun secondaryRoute_hidesBottomBar_andShowsBackButton() {
        composeRule.setContent {
            ScaffoldNavigationTestHost(trackDashboardReselect = false)
        }

        composeRule.onNodeWithText("Open Add Item").performClick()
        assertNodeWithTextExists("Screen:add_item")
        assertNodeWithTextMissing("Home")
        assertNodeWithContentDescriptionExists("Back")
        composeRule.onNodeWithContentDescription("Back").performClick()
        assertNodeWithTextExists("Screen:dashboard")
    }

    @Test
    fun selectingWardrobeTabFromNestedRoute_popsToWardrobeRoot() {
        composeRule.setContent {
            ScaffoldNavigationTestHost(trackDashboardReselect = false)
        }

        composeRule.onNodeWithText("Wardrobe").performClick()
        assertNodeWithTextExists("Screen:wardrobe")
        composeRule.onNodeWithText("Open Wardrobe Sub").performClick()
        assertNodeWithTextExists("Screen:wardrobe_sub")
        composeRule.onNodeWithText("Wardrobe").performClick()
        assertNodeWithTextExists("Screen:wardrobe")
    }

    @Test
    fun secondTapOnActiveHomeTab_dispatchesReselectEvent() {
        composeRule.setContent {
            ScaffoldNavigationTestHost(trackDashboardReselect = true)
        }

        assertNodeWithTextExists("Reselect count: 0")
        composeRule.onNodeWithText("Home").performClick()
        composeRule.onNodeWithText("Home").performClick()
        composeRule.waitUntil(timeoutMillis = 3_000) {
            composeRule.onAllNodesWithText("Reselect count: 1").fetchSemanticsNodes().isNotEmpty()
        }
        assertNodeWithTextExists("Reselect count: 1")
    }

    private fun assertNodeWithTextExists(text: String) {
        assertTrue(
            "Expected node with text '$text' to exist",
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        )
    }

    private fun assertNodeWithTextMissing(text: String) {
        assertFalse(
            "Expected node with text '$text' to be absent",
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        )
    }

    private fun assertNodeWithContentDescriptionExists(description: String) {
        assertTrue(
            "Expected node with contentDescription '$description' to exist",
            composeRule.onAllNodesWithContentDescription(description).fetchSemanticsNodes().isNotEmpty()
        )
    }
}

@Composable
private fun ScaffoldNavigationTestHost(
    trackDashboardReselect: Boolean
) {
    val navController = rememberNavController()
    var dashboardReselectCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(trackDashboardReselect) {
        if (!trackDashboardReselect) return@LaunchedEffect
        TopLevelReselectBus.events.collectLatest { route ->
            if (route == Routes.DASHBOARD) {
                dashboardReselectCount += 1
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Routes.DASHBOARD
    ) {
        composable(Routes.DASHBOARD) {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = Routes.DASHBOARD,
                title = "Dashboard",
                screenLabel = "dashboard",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            ) {
                Button(
                    onClick = { navController.navigateToSecondary(Routes.ADD_ITEM) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Open Add Item")
                }
            }
        }

        composable(Routes.WARDROBE) {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = Routes.WARDROBE,
                title = "Wardrobe",
                screenLabel = "wardrobe",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            ) {
                Button(
                    onClick = { navController.navigate("wardrobe/sub") },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Open Wardrobe Sub")
                }
            }
        }

        composable("wardrobe/sub") {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = "wardrobe/sub",
                title = "Wardrobe Sub",
                screenLabel = "wardrobe_sub",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            )
        }

        composable(Routes.RECOMMENDATION) {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = Routes.RECOMMENDATION,
                title = "Recommendation",
                screenLabel = "recommendation",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            )
        }

        composable(Routes.PROFILE) {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = Routes.PROFILE,
                title = "Profile",
                screenLabel = "profile",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            )
        }

        composable(Routes.ADD_ITEM) {
            TestScaffoldScreen(
                navController = navController,
                currentRoute = Routes.ADD_ITEM,
                title = "Add Item",
                screenLabel = "add_item",
                reselectCount = if (trackDashboardReselect) dashboardReselectCount else null
            )
        }
    }
}

@Composable
private fun TestScaffoldScreen(
    navController: NavController,
    currentRoute: String,
    title: String,
    screenLabel: String,
    reselectCount: Int?,
    extraContent: @Composable (() -> Unit)? = null
) {
    FitGptScaffold(
        navController = navController,
        currentRoute = currentRoute,
        title = title,
        showChatAction = false,
        showMoreAction = false
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("Screen:$screenLabel")
            reselectCount?.let { count ->
                Text("Reselect count: $count")
            }
            extraContent?.invoke()
        }
    }
}
