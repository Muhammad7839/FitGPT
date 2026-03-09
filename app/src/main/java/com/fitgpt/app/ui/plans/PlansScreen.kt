package com.fitgpt.app.ui.plans

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.EmptyStateCard
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.RemoteImagePreview
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.ui.common.isValidPlanDate
import com.fitgpt.app.viewmodel.WardrobeViewModel
import java.time.Instant
import java.time.ZoneId
import androidx.compose.material3.rememberDatePickerState

/**
 * Plans section that schedules the current recommended outfit for a future date.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PlansScreen(
    navController: NavController,
    viewModel: WardrobeViewModel
) {
    val plans by viewModel.plannedState.collectAsState()
    var planDate by remember { mutableStateOf("") }
    var planDatesCsv by remember { mutableStateOf("") }
    var occasion by remember { mutableStateOf("") }
    var replaceExisting by remember { mutableStateOf(true) }
    var planError by remember { mutableStateOf<String?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState()

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.PLANS,
        title = "Plans"
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            SectionHeader(
                title = "Planned Outfits",
                subtitle = "Manage your upcoming outfit plans"
            )

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Plan current recommendation", style = MaterialTheme.typography.titleMedium)
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
                        label = { Text("Assign dates CSV (YYYY-MM-DD,...)") },
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
                        Text("Replace existing entries on same date")
                    }
                    Button(
                        onClick = {
                            if (!isValidPlanDate(planDate)) {
                                planError = "Date must be in YYYY-MM-DD format"
                                return@Button
                            }
                            planError = null
                            viewModel.planCurrentRecommendation(
                                planDate = planDate.trim(),
                                occasion = occasion
                            )
                            planDate = ""
                            occasion = ""
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Plan")
                    }
                    Button(
                        onClick = {
                            val parsedDates = planDatesCsv
                                .split(",")
                                .map { it.trim() }
                                .filter { it.isNotEmpty() }
                            if (parsedDates.isEmpty() || parsedDates.any { !isValidPlanDate(it) }) {
                                planError = "Assignment dates must be YYYY-MM-DD, comma-separated"
                                return@Button
                            }
                            planError = null
                            viewModel.assignCurrentRecommendationToDates(
                                plannedDates = parsedDates,
                                occasion = occasion.takeIf { it.isNotBlank() },
                                replaceExisting = replaceExisting
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Assign to Dates")
                    }
                    planError?.let {
                        Text(
                            text = it,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                    Text(
                        text = "Tap the calendar icon for quick selection or type manually.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (plans.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    EmptyStateCard(
                        title = "No planned outfits",
                        subtitle = "Plan outfits from recommendations or saved outfits."
                    )
                    Button(
                        onClick = { navController.navigate(Routes.DASHBOARD) },
                        modifier = Modifier.padding(top = 12.dp)
                    ) {
                        Text("Go to Dashboard")
                    }
                }
                return@FitGptScaffold
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(plans) { plan ->
                    WebCard(
                        modifier = Modifier.fillMaxWidth(),
                        accentTop = false
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(plan.planDate, style = MaterialTheme.typography.titleMedium)
                                WebBadge(
                                    text = "Planned",
                                    background = MaterialTheme.colorScheme.secondary.copy(alpha = 0.16f)
                                )
                            }
                            if (plan.occasion.isNotBlank()) {
                                Text(
                                    text = plan.occasion,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
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
                                text = plan.items.joinToString { it.category },
                                style = MaterialTheme.typography.bodySmall
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = { viewModel.wearPlannedOutfit(plan.id) }) {
                                    Text("Wear")
                                }
                                Button(onClick = { viewModel.removePlannedOutfit(plan.id) }) {
                                    Text("Remove")
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
                        val selectedDate = datePickerState.selectedDateMillis?.let(::millisToIsoDate)
                        if (selectedDate != null) {
                            planDate = selectedDate
                            planError = null
                        }
                        showDatePicker = false
                    }
                ) {
                    Text("Use Date")
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

private fun millisToIsoDate(millis: Long): String {
    return Instant.ofEpochMilli(millis)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .toString()
}
