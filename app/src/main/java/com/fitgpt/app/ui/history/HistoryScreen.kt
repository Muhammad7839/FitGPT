package com.fitgpt.app.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.data.model.ClothingItem
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class HistoryTab {
    HISTORY,
    ANALYTICS
}

private enum class HistoryRangeFilter {
    LAST_7_DAYS,
    LAST_30_DAYS,
    ALL
}

private data class HistoryDateRange(
    val startDate: String,
    val endDate: String
)

/**
 * Combined History + Analytics screen mirroring the web tab structure.
 */
@Composable
fun HistoryScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val history by viewModel.historyState.collectAsState()
    val wardrobeState by viewModel.wardrobeState.collectAsState()
    val savedOutfits by viewModel.savedOutfitsState.collectAsState()
    val plannedOutfits by viewModel.plannedState.collectAsState()

    var activeTab by remember { mutableStateOf(HistoryTab.HISTORY) }
    var rangeFilter by remember { mutableStateOf(HistoryRangeFilter.LAST_30_DAYS) }
    val dateRange = remember(rangeFilter) { resolveRange(rangeFilter) }

    LaunchedEffect(activeTab, rangeFilter) {
        if (activeTab == HistoryTab.HISTORY) {
            if (dateRange == null) {
                viewModel.refreshHistory()
            } else {
                viewModel.refreshHistoryInRange(dateRange.startDate, dateRange.endDate)
            }
        }
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.HISTORY,
        title = "History"
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionHeader(
                title = "Outfit History",
                subtitle = "Track what you wore and review your style patterns"
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = activeTab == HistoryTab.HISTORY,
                    onClick = { activeTab = HistoryTab.HISTORY },
                    label = { Text("History") }
                )
                FilterChip(
                    selected = activeTab == HistoryTab.ANALYTICS,
                    onClick = { activeTab = HistoryTab.ANALYTICS },
                    label = { Text("Analytics") }
                )
            }

            when (activeTab) {
                HistoryTab.HISTORY -> {
                    Button(
                        onClick = { viewModel.clearHistory() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Clear History")
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = rangeFilter == HistoryRangeFilter.LAST_7_DAYS,
                            onClick = { rangeFilter = HistoryRangeFilter.LAST_7_DAYS },
                            label = { Text("Last 7 days") }
                        )
                        FilterChip(
                            selected = rangeFilter == HistoryRangeFilter.LAST_30_DAYS,
                            onClick = { rangeFilter = HistoryRangeFilter.LAST_30_DAYS },
                            label = { Text("Last 30 days") }
                        )
                        FilterChip(
                            selected = rangeFilter == HistoryRangeFilter.ALL,
                            onClick = { rangeFilter = HistoryRangeFilter.ALL },
                            label = { Text("All") }
                        )
                    }

                    if (history.isEmpty()) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            EmptyStateCard(
                                title = "No outfit history yet",
                                subtitle = "Wear a recommendation to start style tracking."
                            )
                        }
                        return@Column
                    }

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val groupedHistory = history.groupBy { formatDayHeader(it.wornAtTimestamp) }
                        groupedHistory.forEach { (dayLabel, entriesForDay) ->
                            item {
                                Text(
                                    text = dayLabel,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            items(entriesForDay, key = { entry -> entry.id }) { entry ->
                                WebCard(
                                    modifier = Modifier.fillMaxWidth(),
                                    accentTop = false
                                ) {
                                    Column(modifier = Modifier.padding(14.dp)) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            entry.items.take(4).forEach { item ->
                                                RemoteImagePreview(
                                                    imageUrl = item.imageUrl,
                                                    contentDescription = item.category,
                                                    modifier = Modifier.size(52.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.size(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = entry.items.joinToString { it.category },
                                                style = MaterialTheme.typography.titleMedium
                                            )
                                            WebBadge(
                                                text = entry.source.replaceFirstChar { it.uppercase() }
                                            )
                                        }
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = formatTimestamp(entry.wornAtTimestamp),
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                            TextButton(
                                                onClick = {
                                                    viewModel.deleteHistoryEntry(
                                                        historyId = entry.id,
                                                        startDate = dateRange?.startDate,
                                                        endDate = dateRange?.endDate
                                                    )
                                                }
                                            ) {
                                                Text("Delete")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                HistoryTab.ANALYTICS -> {
                    val wardrobeItems = (wardrobeState as? UiState.Success<List<ClothingItem>>)
                        ?.data
                        .orEmpty()
                    val activeItems = wardrobeItems.filter { !it.isArchived }
                    val favoriteItems = activeItems.filter { it.isFavorite }

                    val wornIds = history.flatMap { entry -> entry.items.map { it.id } }.toSet()
                    val utilization = if (activeItems.isNotEmpty()) {
                        ((wornIds.size.toFloat() / activeItems.size.toFloat()) * 100f).toInt()
                    } else {
                        0
                    }

                    val categoryCounts = history
                        .flatMap { it.items }
                        .groupingBy { it.category }
                        .eachCount()
                    val topCategory = categoryCounts.maxByOrNull { it.value }?.key ?: "-"

                    val uniqueOutfits = history
                        .map { entry -> entry.items.map { it.id }.sorted().joinToString("|") }
                        .toSet()
                        .size

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        item {
                            AnalyticsCard("Active wardrobe items", activeItems.size.toString())
                        }
                        item {
                            AnalyticsCard("Favorites", favoriteItems.size.toString())
                        }
                        item {
                            AnalyticsCard("Saved outfits", savedOutfits.size.toString())
                        }
                        item {
                            AnalyticsCard("Planned outfits", plannedOutfits.size.toString())
                        }
                        item {
                            AnalyticsCard("Outfits worn", history.size.toString())
                        }
                        item {
                            AnalyticsCard("Unique outfit combos", uniqueOutfits.toString())
                        }
                        item {
                            AnalyticsCard("Wardrobe utilization", "$utilization%")
                        }
                        item {
                            AnalyticsCard("Most worn category", topCategory)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnalyticsCard(label: String, value: String) {
    WebCard(
        modifier = Modifier.fillMaxWidth(),
        accentTop = false
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge
            )
        }
    }
}

private fun resolveRange(filter: HistoryRangeFilter): HistoryDateRange? {
    if (filter == HistoryRangeFilter.ALL) {
        return null
    }
    val now = LocalDate.now()
    val start = when (filter) {
        HistoryRangeFilter.LAST_7_DAYS -> now.minusDays(6)
        HistoryRangeFilter.LAST_30_DAYS -> now.minusDays(29)
        HistoryRangeFilter.ALL -> now
    }
    val formatter = DateTimeFormatter.ISO_LOCAL_DATE
    return HistoryDateRange(
        startDate = start.format(formatter),
        endDate = now.format(formatter)
    )
}

private fun formatDayHeader(timestamp: Long): String {
    val formatter = SimpleDateFormat("EEEE, MMM d yyyy", Locale.getDefault())
    return formatter.format(Date(normalizeTimestamp(timestamp)))
}

private fun formatTimestamp(timestamp: Long): String {
    val formatter = SimpleDateFormat("EEE, MMM d yyyy • h:mm a", Locale.getDefault())
    return formatter.format(Date(normalizeTimestamp(timestamp)))
}

private fun normalizeTimestamp(timestamp: Long): Long {
    return if (timestamp < 100_000_000_000L) {
        timestamp * 1000
    } else {
        timestamp
    }
}
