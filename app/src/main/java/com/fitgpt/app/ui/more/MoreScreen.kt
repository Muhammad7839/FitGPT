/**
 * Secondary navigation hub for non-primary flows moved out of the bottom bar.
 */
package com.fitgpt.app.ui.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebCard

@Composable
fun MoreScreen(
    navController: NavController
) {
    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.MORE,
        title = "More",
        showMoreAction = false
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionHeader(
                title = "More",
                subtitle = "Favorites, saved outfits, history, plans, and app settings."
            )

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Outfit Tools", style = MaterialTheme.typography.titleMedium)
                    MoreActionRow(
                        icon = { Icon(Icons.Default.Star, contentDescription = null) },
                        title = "Chat",
                        subtitle = "Ask AI stylist for quick guidance",
                        onClick = { navController.navigateToSecondary(Routes.CHAT) }
                    )
                    MoreActionRow(
                        icon = { Icon(Icons.Default.Favorite, contentDescription = null) },
                        title = "Favorites",
                        subtitle = "Pin and revisit go-to items",
                        onClick = { navController.navigateToSecondary(Routes.FAVORITES) }
                    )
                    MoreActionRow(
                        icon = { Icon(Icons.Default.Star, contentDescription = null) },
                        title = "Saved Outfits",
                        subtitle = "Reuse generated combinations",
                        onClick = { navController.navigateToSecondary(Routes.SAVED_OUTFITS) }
                    )
                    MoreActionRow(
                        icon = { Icon(Icons.Default.Info, contentDescription = null) },
                        title = "History",
                        subtitle = "Track what you wore",
                        onClick = { navController.navigateToSecondary(Routes.HISTORY) }
                    )
                    MoreActionRow(
                        icon = { Icon(Icons.Default.DateRange, contentDescription = null) },
                        title = "Plans",
                        subtitle = "Schedule outfits by date",
                        onClick = { navController.navigateToSecondary(Routes.PLANS) }
                    )
                }
            }

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("App", style = MaterialTheme.typography.titleMedium)
                    MoreActionRow(
                        icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                        title = "Settings",
                        subtitle = "Appearance and app preferences",
                        onClick = { navController.navigateToSecondary(Routes.SETTINGS) }
                    )
                }
            }
        }
    }
}

@Composable
private fun MoreActionRow(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    WebCard(
        modifier = Modifier.fillMaxWidth(),
        accentTop = false,
        onClick = onClick
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            icon()
            Text(text = title, style = MaterialTheme.typography.titleSmall)
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
