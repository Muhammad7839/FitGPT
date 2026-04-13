/**
 * Mobile-first onboarding flow aligned to the web product sequence.
 */
package com.fitgpt.app.ui.onboarding

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.fitgpt.app.R
import com.fitgpt.app.data.model.OnboardingAnswers
import com.fitgpt.app.ui.common.BrandingBackgroundLayer
import com.fitgpt.app.ui.common.FormOptionCatalog
import com.fitgpt.app.ui.common.SelectableField
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.OnboardingViewModel

private const val TOTAL_STEPS = 5

@Composable
fun WelcomeScreen(
    viewModel: OnboardingViewModel,
    isSubmitting: Boolean = false,
    submitError: String? = null,
    onComplete: (OnboardingAnswers) -> Unit
) {
    val savedAnswers by viewModel.answers.collectAsState()
    var hasInitialized by rememberSaveable { mutableStateOf(false) }
    var step by rememberSaveable { mutableIntStateOf(1) }
    var stylePreferences by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var comfortPreferences by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var dressFor by rememberSaveable { mutableStateOf(emptyList<String>()) }
    var bodyType by rememberSaveable { mutableStateOf("") }
    var gender by rememberSaveable { mutableStateOf("") }
    var heightCm by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(savedAnswers) {
        if (hasInitialized) return@LaunchedEffect
        stylePreferences = savedAnswers.stylePreferences
        comfortPreferences = savedAnswers.comfortPreferences
        dressFor = savedAnswers.dressFor
        bodyType = savedAnswers.bodyType.orEmpty()
        gender = savedAnswers.gender.orEmpty()
        heightCm = savedAnswers.heightCm?.toString().orEmpty()
        hasInitialized = true
    }

    fun currentAnswers(): OnboardingAnswers {
        return OnboardingAnswers(
            stylePreferences = stylePreferences,
            comfortPreferences = comfortPreferences,
            dressFor = dressFor,
            bodyType = bodyType.takeIf { it.isNotBlank() },
            gender = gender
                .takeIf { it.isNotBlank() && it != "Prefer not to say" },
            heightCm = heightCm.trim().toIntOrNull()
        )
    }

    fun finishOnboarding() {
        val answers = currentAnswers()
        viewModel.saveAnswers(answers)
        onComplete(answers)
    }

    fun skipCurrentStep() {
        when (step) {
            2 -> {
                stylePreferences = emptyList()
                comfortPreferences = emptyList()
            }
            3 -> dressFor = emptyList()
            4 -> {
                bodyType = ""
                gender = ""
                heightCm = ""
            }
        }
        finishOnboarding()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        BrandingBackgroundLayer(logoOpacity = 0.08f)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Button(
                    onClick = { if (step > 1) step -= 1 },
                    enabled = step > 1 && !isSubmitting
                ) {
                    Text("Back")
                }
                if (step in 2..4) {
                    Button(
                        onClick = {
                            viewModel.saveAnswers(currentAnswers())
                            skipCurrentStep()
                        },
                        enabled = !isSubmitting
                    ) {
                        Text("Skip")
                    }
                } else {
                    Spacer(modifier = Modifier.size(1.dp))
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            LinearProgressIndicator(
                progress = { step / TOTAL_STEPS.toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            GuidedSpotlightCard(step = step)

            Spacer(modifier = Modifier.height(16.dp))

            WebCard(modifier = Modifier.fillMaxWidth(), accentTop = false) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    when (step) {
                        1 -> IntroStep()
                        2 -> PreferencesStep(
                            stylePreferences = stylePreferences,
                            comfortPreferences = comfortPreferences,
                            onToggleStyle = { option -> stylePreferences = stylePreferences.toggle(option) },
                            onToggleComfort = { option -> comfortPreferences = comfortPreferences.toggle(option) }
                        )
                        3 -> DressForStep(
                            selections = dressFor,
                            onToggle = { option -> dressFor = dressFor.toggle(option) }
                        )
                        4 -> FitProfileStep(
                            bodyType = bodyType,
                            onBodyTypeChange = { bodyType = it },
                            gender = gender,
                            onGenderChange = { gender = it },
                            heightCm = heightCm,
                            onHeightChange = { heightCm = it.filter(Char::isDigit).take(3) }
                        )
                        else -> ReviewStep(currentAnswers())
                    }

                    Button(
                        onClick = {
                            if (step == TOTAL_STEPS) {
                                finishOnboarding()
                            } else {
                                viewModel.saveAnswers(currentAnswers())
                                step += 1
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting
                    ) {
                        Text(
                            when {
                                isSubmitting -> "Saving..."
                                step == TOTAL_STEPS -> "Finish"
                                else -> "Continue"
                            }
                        )
                    }

                    Text(
                        text = "Step $step of $TOTAL_STEPS",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (!submitError.isNullOrBlank()) {
                        Text(
                            text = submitError,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GuidedSpotlightCard(step: Int) {
    val spotlight = spotlightForStep(step)
    val pulse = rememberInfiniteTransition(label = "onboarding-spotlight")
    val accentAlpha by pulse.animateFloat(
        initialValue = 0.22f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100),
            repeatMode = RepeatMode.Reverse
        ),
        label = "onboarding-spotlight-alpha"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(
                brush = Brush.linearGradient(
                    listOf(
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.14f),
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.08f)
                    )
                )
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.primary.copy(alpha = accentAlpha),
                shape = RoundedCornerShape(26.dp)
            )
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "Guided setup",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = spotlight.title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = spotlight.body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.72f)
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "Focus now",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = spotlight.callout,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun IntroStep() {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                painter = painterResource(id = R.drawable.fitgpt_splash_brand),
                contentDescription = "FitGPT",
                modifier = Modifier.size(76.dp)
            )
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Welcome to FitGPT",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Set your style direction once, then keep recommendations consistent across the app.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        FeatureCard("Upload your wardrobe", "Build your closet with photos so suggestions use what you actually own.")
        FeatureCard("Get daily outfit guidance", "Recommendations respond to your context, saved looks, and planning flow.")
        FeatureCard("Keep your style profile in sync", "Your preferences shape onboarding, recommendations, and planning.")
    }
}

@Composable
private fun PreferencesStep(
    stylePreferences: List<String>,
    comfortPreferences: List<String>,
    onToggleStyle: (String) -> Unit,
    onToggleComfort: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Quick preferences", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(
            "Choose anything that already feels like you. You can refine it later in profile.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text("Style", style = MaterialTheme.typography.titleMedium)
        ChipGroup(
            options = FormOptionCatalog.onboardingStyleOptions,
            selected = stylePreferences,
            onToggle = onToggleStyle
        )
        SummaryNote("Style", stylePreferences)
        Text("Comfort", style = MaterialTheme.typography.titleMedium)
        ChipGroup(
            options = FormOptionCatalog.onboardingComfortOptions,
            selected = comfortPreferences,
            onToggle = onToggleComfort
        )
        SummaryNote("Comfort", comfortPreferences)
    }
}

@Composable
private fun DressForStep(
    selections: List<String>,
    onToggle: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("What do you dress for?", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(
            "This helps FitGPT steer recommendations toward your routine, not generic looks.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        ChipGroup(
            options = FormOptionCatalog.onboardingDressForOptions,
            selected = selections,
            onToggle = onToggle
        )
        SummaryNote("Selected", selections)
    }
}

@Composable
private fun FitProfileStep(
    bodyType: String,
    onBodyTypeChange: (String) -> Unit,
    gender: String,
    onGenderChange: (String) -> Unit,
    heightCm: String,
    onHeightChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Fit profile", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(
            "Optional details help fit and proportion suggestions without making onboarding heavy.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        FormOptionCatalog.onboardingBodyTypes.forEach { option ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = if (bodyType == option.id) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                } else {
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.28f)
                },
                onClick = { onBodyTypeChange(option.id) }
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(option.label, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = option.note,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        SelectableField(
            label = "Gender",
            selectedValue = gender,
            onValueChange = onGenderChange,
            options = FormOptionCatalog.onboardingGenderOptions.map { it.value.ifBlank { "Prefer not to say" } },
            otherOptionLabel = "Other"
        )
        OutlinedTextField(
            value = heightCm,
            onValueChange = onHeightChange,
            label = { Text("Height in centimeters (optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
    }
}

@Composable
private fun ReviewStep(answers: OnboardingAnswers) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Review", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(
            "These preferences shape recommendations, planning, and your profile setup.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        ReviewCard("Style", answers.stylePreferences.joinToString().ifBlank { "Skipped" })
        ReviewCard("Comfort", answers.comfortPreferences.joinToString().ifBlank { "Skipped" })
        ReviewCard("Dressing for", answers.dressFor.joinToString().ifBlank { "Skipped" })
        ReviewCard("Body type", answers.bodyType ?: "Skipped")
        ReviewCard("Gender", answers.gender ?: "Skipped")
        ReviewCard("Height", answers.heightCm?.let { "$it cm" } ?: "Skipped")
    }
}

@Composable
private fun ChipGroup(
    options: List<String>,
    selected: List<String>,
    onToggle: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.chunked(2).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                row.forEach { option ->
                    FilterChip(
                        selected = selected.contains(option),
                        onClick = { onToggle(option) },
                        label = { Text(option) }
                    )
                }
            }
        }
    }
}

@Composable
private fun FeatureCard(title: String, body: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.28f)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SummaryNote(label: String, values: List<String>) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.24f),
                shape = RoundedCornerShape(16.dp)
            )
            .padding(12.dp)
    ) {
        Text(
            text = "$label: ${values.joinToString().ifBlank { "Skipped" }}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ReviewCard(label: String, value: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.28f)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(value, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun List<String>.toggle(value: String): List<String> {
    return if (contains(value)) {
        filterNot { it == value }
    } else {
        this + value
    }
}

private data class SpotlightContent(
    val title: String,
    val body: String,
    val callout: String
)

private fun spotlightForStep(step: Int): SpotlightContent {
    return when (step) {
        1 -> SpotlightContent(
            title = "A quick guided walkthrough",
            body = "This mobile setup now behaves more like a guided product tour instead of a plain form.",
            callout = "You’ll move step by step through style, routine, fit, and final review."
        )
        2 -> SpotlightContent(
            title = "Choose your style signals",
            body = "Pick the looks and comfort cues that should shape your recommendations everywhere in the app.",
            callout = "Tap the chips that already feel like you."
        )
        3 -> SpotlightContent(
            title = "Tune for real life",
            body = "FitGPT works best when it knows the moments you actually dress for, not just abstract style labels.",
            callout = "Select the situations you want outfit help for most."
        )
        4 -> SpotlightContent(
            title = "Improve fit guidance",
            body = "These details stay optional, but they help proportion and layering advice land better on mobile.",
            callout = "Add only what you want AURA to use for fit-aware suggestions."
        )
        else -> SpotlightContent(
            title = "Review before entering the app",
            body = "This is the last checkpoint before your dashboard and recommendations pick up these settings.",
            callout = "Confirm the profile feels right, then finish onboarding."
        )
    }
}
