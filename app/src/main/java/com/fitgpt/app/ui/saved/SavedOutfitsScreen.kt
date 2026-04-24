package com.fitgpt.app.ui.saved

import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.navigation.navigateToSecondary
import com.fitgpt.app.navigation.navigateToTopLevel
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Saved outfits mirror for reusable combinations.
 */
@Composable
fun SavedOutfitsScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val context = LocalContext.current
    val saved by viewModel.savedOutfitsState.collectAsState()
    val recommendationState by viewModel.recommendationState.collectAsState()
    val saveOutfitState by viewModel.saveOutfitState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val isSavingOutfit = saveOutfitState is UiState.Loading

    LaunchedEffect(saveOutfitState) {
        when (val currentSaveState = saveOutfitState) {
            UiState.Loading -> Unit
            is UiState.Error -> {
                snackbarHostState.showSnackbar(currentSaveState.message)
                viewModel.clearSaveOutfitState()
            }
            is UiState.Success -> {
                if (currentSaveState.data == true) {
                    snackbarHostState.showSnackbar("Outfit saved")
                    viewModel.clearSaveOutfitState()
                }
            }
        }
    }

    fun openCalendarForTomorrow(title: String, itemNames: List<String>) {
        val planDate = LocalDate.now().plusDays(1)
        val startMillis = planDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val endMillis = planDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val intent = Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMillis)
            putExtra(CalendarContract.Events.TITLE, title.ifBlank { "FitGPT saved outfit" })
            putExtra(CalendarContract.Events.DESCRIPTION, itemNames.joinToString(separator = "\n"))
            putExtra(CalendarContract.Events.ALL_DAY, true)
        }
        context.startActivity(intent)
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.SAVED_OUTFITS,
        title = "Saved Outfits",
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionHeader(
                title = "Saved Outfits",
                subtitle = "Reusable outfit combinations for the days you want a quick win."
            )

            if (recommendationState is UiState.Success) {
                val current = (recommendationState as UiState.Success).data
                if (current.isNotEmpty()) {
                    Button(
                        onClick = { viewModel.saveOutfit(current) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSavingOutfit
                    ) {
                        Text(if (isSavingOutfit) "Saving..." else "Save Current Recommendation")
                    }
                }
            }

            if (saved.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    EmptyStateCard(
                        title = "No saved outfits yet",
                        subtitle = "Save your favorite recommendations here so you can reuse or plan them later."
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { navController.navigateToTopLevel(Routes.DASHBOARD) },
                            modifier = Modifier.padding(top = 12.dp)
                        ) {
                            Text("Go to Dashboard")
                        }
                        Button(
                            onClick = { navController.navigateToSecondary(Routes.PLANS) },
                            modifier = Modifier.padding(top = 12.dp)
                        ) {
                            Text("Open Plans")
                        }
                    }
                }
                return@FitGptScaffold
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(saved.sortedByDescending { it.savedAtTimestamp }) { outfit ->
                    val title = outfit.items.firstOrNull()?.name ?: "Saved outfit"
                    val itemNames = outfit.items.mapNotNull { it.name ?: it.category }
                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(title, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        text = formatSavedDate(outfit.savedAtTimestamp),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                WebBadge(text = "Saved")
                            }
                            Text(
                                text = itemNames.joinToString(" • "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                outfit.items.take(4).forEach { item ->
                                    RemoteImagePreview(
                                        imageUrl = item.imageUrl,
                                        contentDescription = item.category,
                                        modifier = Modifier.size(58.dp)
                                    )
                                }
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        viewModel.markOutfitAsWorn(outfit.items)
                                        navController.navigateToSecondary(Routes.HISTORY)
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Wear Again")
                                }
                                Button(
                                    onClick = {
                                        val tomorrow = LocalDate.now().plusDays(1).toString()
                                        viewModel.planOutfitFromSaved(outfit.items, tomorrow, "")
                                        openCalendarForTomorrow(title, itemNames)
                                        navController.navigateToSecondary(Routes.PLANS)
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Plan for Later")
                                }
                            }
                            Button(
                                onClick = { viewModel.removeSavedOutfit(outfit.id) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Remove")
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatSavedDate(timestamp: Long): String {
    val instant = java.time.Instant.ofEpochMilli(timestamp)
    return instant
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .format(DateTimeFormatter.ofPattern("MMM d"))
}
