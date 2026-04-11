package com.fitgpt.app.ui.plans

import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.fitgpt.app.ui.common.isValidPlanDate
import com.fitgpt.app.viewmodel.UiState
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private enum class PlansTab {
    UPCOMING,
    TRIP_PLANNER
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PlansScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val context = LocalContext.current
    val plans by viewModel.plannedState.collectAsState()
    val tripPackingState by viewModel.tripPackingState.collectAsState()
    val recommendationState by viewModel.recommendationState.collectAsState()
    var activeTab by remember { mutableStateOf(PlansTab.UPCOMING) }
    var planDate by remember { mutableStateOf(LocalDate.now().plusDays(1).toString()) }
    var planDatesCsv by remember { mutableStateOf("") }
    var occasion by remember { mutableStateOf("") }
    var destinationCity by remember { mutableStateOf("") }
    var tripDaysInput by remember { mutableStateOf("3") }
    var replaceExisting by remember { mutableStateOf(true) }
    var planError by remember { mutableStateOf<String?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState()

    val today = remember { LocalDate.now().toString() }
    val upcomingPlans = plans.filter { it.planDate >= today }.sortedBy { it.planDate }
    val pastPlans = plans.filter { it.planDate < today }.sortedByDescending { it.planDate }
    val hasCurrentRecommendation = (recommendationState as? UiState.Success)?.data?.isNotEmpty() == true

    fun addPlanToCalendar(planDateValue: String, occasionValue: String, itemNames: List<String>) {
        val parsedDate = runCatching { LocalDate.parse(planDateValue) }.getOrNull() ?: return
        val startMillis = parsedDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val endMillis = parsedDate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val description = itemNames.joinToString(separator = "\n")
        val intent = Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMillis)
            putExtra(CalendarContract.Events.TITLE, occasionValue.ifBlank { "FitGPT planned outfit" })
            putExtra(CalendarContract.Events.DESCRIPTION, description)
            putExtra(CalendarContract.Events.ALL_DAY, true)
        }
        context.startActivity(intent)
    }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.PLANS,
        title = "Plans"
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
                title = "Planned Outfits",
                subtitle = "Schedule looks ahead and keep travel planning in one place."
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = activeTab == PlansTab.UPCOMING,
                    onClick = { activeTab = PlansTab.UPCOMING },
                    label = { Text("Upcoming") }
                )
                FilterChip(
                    selected = activeTab == PlansTab.TRIP_PLANNER,
                    onClick = { activeTab = PlansTab.TRIP_PLANNER },
                    label = { Text("Trip Planner") }
                )
            }

            when (activeTab) {
                PlansTab.UPCOMING -> {
                    WebCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Plan current recommendation", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = if (hasCurrentRecommendation) {
                                    "Save the current look for a date or assign it to several dates at once."
                                } else {
                                    "Get a recommendation first, then save it here for later."
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            OutlinedTextField(
                                value = planDate,
                                onValueChange = { planDate = it },
                                label = { Text("Plan date (YYYY-MM-DD)") },
                                modifier = Modifier.fillMaxWidth(),
                                trailingIcon = {
                                    IconButton(onClick = { showDatePicker = true }) {
                                        Icon(
                                            imageVector = Icons.Default.DateRange,
                                            contentDescription = "Open calendar"
                                        )
                                    }
                                }
                            )
                            OutlinedTextField(
                                value = occasion,
                                onValueChange = { occasion = it },
                                label = { Text("Occasion") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = planDatesCsv,
                                onValueChange = { planDatesCsv = it },
                                label = { Text("Extra dates (optional, comma-separated)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = replaceExisting,
                                    onCheckedChange = { replaceExisting = it }
                                )
                                Text("Replace existing outfits on those dates")
                            }
                            Button(
                                onClick = {
                                    if (!isValidPlanDate(planDate) || !hasCurrentRecommendation) {
                                        planError = if (hasCurrentRecommendation) {
                                            "Use YYYY-MM-DD for your plan date"
                                        } else {
                                            "Get a recommendation before saving a plan"
                                        }
                                        return@Button
                                    }
                                    planError = null
                                    viewModel.planCurrentRecommendation(
                                        planDate = planDate.trim(),
                                        occasion = occasion
                                    )
                                    planDatesCsv = ""
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = hasCurrentRecommendation
                            ) {
                                Text("Save Plan")
                            }
                            Button(
                                onClick = {
                                    val parsedDates = planDatesCsv
                                        .split(",")
                                        .map { it.trim() }
                                        .filter { it.isNotEmpty() }
                                    if (parsedDates.isEmpty() || parsedDates.any { !isValidPlanDate(it) } || !hasCurrentRecommendation) {
                                        planError = if (hasCurrentRecommendation) {
                                            "Enter extra dates as YYYY-MM-DD, separated by commas"
                                        } else {
                                            "Get a recommendation before assigning dates"
                                        }
                                        return@Button
                                    }
                                    planError = null
                                    viewModel.assignCurrentRecommendationToDates(
                                        plannedDates = parsedDates,
                                        occasion = occasion.takeIf { it.isNotBlank() },
                                        replaceExisting = replaceExisting
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = hasCurrentRecommendation
                            ) {
                                Text("Assign to Dates")
                            }
                            planError?.let {
                                Text(text = it, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    if (upcomingPlans.isEmpty() && pastPlans.isEmpty()) {
                        Column(
                            modifier = Modifier
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            EmptyStateCard(
                                title = "No planned outfits yet",
                                subtitle = "Plan looks for work, travel, events, or weekends so the next outfit is already decided."
                            )
                            Button(
                                onClick = { navController.navigateToTopLevel(Routes.DASHBOARD) },
                                modifier = Modifier.padding(top = 12.dp)
                            ) {
                                Text("Go to Dashboard")
                            }
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            if (upcomingPlans.isNotEmpty()) {
                                Text("Upcoming", style = MaterialTheme.typography.titleMedium)
                                upcomingPlans.forEach { plan ->
                                    PlannedOutfitCard(
                                        plan = plan,
                                        onWear = { viewModel.wearPlannedOutfit(plan.id) },
                                        onAddToCalendar = {
                                            addPlanToCalendar(
                                                planDateValue = plan.planDate,
                                                occasionValue = plan.occasion,
                                                itemNames = plan.items.mapNotNull { it.name ?: it.category }
                                            )
                                        },
                                        onRemove = { viewModel.removePlannedOutfit(plan.id) }
                                    )
                                }
                            }
                            if (pastPlans.isNotEmpty()) {
                                Text("Past plans", style = MaterialTheme.typography.titleMedium)
                                pastPlans.forEach { plan ->
                                    PlannedOutfitCard(
                                        plan = plan,
                                        onWear = { viewModel.wearPlannedOutfit(plan.id) },
                                        onAddToCalendar = {
                                            addPlanToCalendar(
                                                planDateValue = plan.planDate,
                                                occasionValue = plan.occasion,
                                                itemNames = plan.items.mapNotNull { it.name ?: it.category }
                                            )
                                        },
                                        onRemove = { viewModel.removePlannedOutfit(plan.id) }
                                    )
                                }
                            }
                        }
                    }
                }

                PlansTab.TRIP_PLANNER -> {
                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Trip Planner", style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = "Generate a packing list based on your destination and trip length.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            OutlinedTextField(
                                value = destinationCity,
                                onValueChange = { destinationCity = it },
                                label = { Text("Destination city") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = planDate,
                                onValueChange = { planDate = it },
                                label = { Text("Start date (YYYY-MM-DD)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = tripDaysInput,
                                onValueChange = { tripDaysInput = it.filter(Char::isDigit).take(2) },
                                label = { Text("Trip days") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                onClick = {
                                    val tripDays = tripDaysInput.toIntOrNull()
                                    if (destinationCity.isBlank() || !isValidPlanDate(planDate) || tripDays == null || tripDays <= 0) {
                                        planError = "Destination, start date, and trip days are required"
                                        return@Button
                                    }
                                    planError = null
                                    viewModel.generateTripPackingList(
                                        destinationCity = destinationCity.trim(),
                                        startDate = planDate.trim(),
                                        tripDays = tripDays
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Generate Packing List")
                            }
                            planError?.let {
                                Text(text = it, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Packing list", style = MaterialTheme.typography.titleMedium)
                            when (val state = tripPackingState) {
                                UiState.Loading -> {
                                    Text("Building packing list...", style = MaterialTheme.typography.bodySmall)
                                }
                                is UiState.Success -> {
                                    val packing = state.data
                                    if (packing == null) {
                                        Text(
                                            text = "Your trip packing summary will appear here after generation.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    } else {
                                        Text(
                                            text = "${packing.destinationCity} • ${packing.weatherSummary}",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                        packing.items.forEach { item ->
                                            Text(
                                                text = "${item.category}: ${item.selectedItemNames.size}/${item.recommendedQuantity} packed",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                                is UiState.Error -> {
                                    Text(state.message, color = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                Button(
                    onClick = {
                        val selectedDateMillis = datePickerState.selectedDateMillis
                        if (selectedDateMillis != null) {
                            planDate = Instant.ofEpochMilli(selectedDateMillis)
                                .atZone(ZoneId.systemDefault())
                                .toLocalDate()
                                .toString()
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("Select")
                }
            },
            dismissButton = {
                Button(onClick = { showDatePicker = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@Composable
private fun PlannedOutfitCard(
    plan: com.fitgpt.app.data.model.PlannedOutfit,
    onWear: () -> Unit,
    onAddToCalendar: () -> Unit,
    onRemove: () -> Unit
) {
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
                    Text(plan.planDate, style = MaterialTheme.typography.titleMedium)
                    if (plan.occasion.isNotBlank()) {
                        Text(
                            text = plan.occasion,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                WebBadge(
                    text = "Planned",
                    background = MaterialTheme.colorScheme.secondary.copy(alpha = 0.16f)
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                plan.items.take(4).forEach { item ->
                    RemoteImagePreview(
                        imageUrl = item.imageUrl,
                        contentDescription = item.category,
                        modifier = Modifier.size(56.dp)
                    )
                }
            }
            Text(
                text = plan.items.joinToString(" • ") { it.name ?: it.category },
                style = MaterialTheme.typography.bodySmall
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onWear) {
                    Text("Wear This")
                }
                Button(onClick = onAddToCalendar) {
                    Text("Add to Calendar")
                }
                Button(onClick = onRemove) {
                    Text("Remove")
                }
            }
        }
    }
}
