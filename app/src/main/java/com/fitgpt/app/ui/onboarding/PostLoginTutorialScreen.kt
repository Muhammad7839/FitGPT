/**
 * Visual post-login tutorial shown once to explain the core FitGPT flows.
 * Polished: slide/fade animated page transitions, better text contrast,
 * clear progress dots, and proper Skip/Next/Finish hierarchy.
 */
package com.fitgpt.app.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.fitgpt.app.R
import com.fitgpt.app.ui.common.WebCard

private data class TutorialPage(
    val title: String,
    val message: String,
    val emoji: String = ""
)

private val tutorialPages = listOf(
    TutorialPage(
        title = "Upload your clothes",
        message = "Head to Wardrobe and snap or upload photos of your items. FitGPT auto-identifies category and color so you can get going fast.",
        emoji = "👕"
    ),
    TutorialPage(
        title = "Get daily outfit picks",
        message = "The Home screen suggests 3 outfits each day, adjusted for weather, time, and your style. Tap Refresh for new ideas.",
        emoji = "✨"
    ),
    TutorialPage(
        title = "Chat with AURA anytime",
        message = "Tap the AURA button on any screen to get personalized style help, outfit ideas, or quick fashion advice from your AI stylist.",
        emoji = "💬"
    )
)

@Composable
fun PostLoginTutorialScreen(
    onComplete: () -> Unit
) {
    var pageIndex by remember { mutableIntStateOf(0) }
    val isLast = pageIndex == tutorialPages.lastIndex

    val pulseTransition = rememberInfiniteTransition(label = "tutorial-pulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 0.97f,
        targetValue = 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1800),
            repeatMode = RepeatMode.Reverse
        ),
        label = "logo-scale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {

            // ── Header ──────────────────────────────────────────────────────
            Column {
                Text(
                    text = "Quick tour",
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${pageIndex + 1} of ${tutorialPages.size}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // ── Animated page card ───────────────────────────────────────────
            AnimatedContent(
                targetState = pageIndex,
                transitionSpec = {
                    if (targetState > initialState) {
                        (slideInHorizontally { it / 2 } + fadeIn(tween(280))) togetherWith
                                (slideOutHorizontally { -it / 2 } + fadeOut(tween(180)))
                    } else {
                        (slideInHorizontally { -it / 2 } + fadeIn(tween(280))) togetherWith
                                (slideOutHorizontally { it / 2 } + fadeOut(tween(180)))
                    }
                },
                label = "tutorial-page"
            ) { idx ->
                val page = tutorialPages[idx]
                WebCard(
                    modifier = Modifier.fillMaxWidth(),
                    accentTop = true
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.fitgpt_splash_brand),
                            contentDescription = "FitGPT",
                            modifier = Modifier
                                .size(120.dp)
                                .scale(pulseScale)
                        )
                        if (page.emoji.isNotEmpty()) {
                            Text(
                                text = page.emoji,
                                style = MaterialTheme.typography.headlineLarge,
                                textAlign = TextAlign.Center
                            )
                        }
                        Text(
                            text = page.title,
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = page.message,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            lineHeight = MaterialTheme.typography.bodyLarge.lineHeight
                        )
                    }
                }
            }

            // ── Footer: dots + buttons ───────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {

                // Progress dots
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    tutorialPages.forEachIndexed { index, _ ->
                        val isActive = index == pageIndex
                        Box(
                            modifier = Modifier
                                .padding(horizontal = 4.dp)
                                .width(if (isActive) 22.dp else 8.dp)
                                .height(8.dp)
                                .clip(CircleShape)
                                .background(
                                    color = if (isActive)
                                        MaterialTheme.colorScheme.primary
                                    else
                                        MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                                )
                        )
                    }
                }

                // Primary action
                Button(
                    onClick = {
                        if (isLast) onComplete() else pageIndex += 1
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(
                        text = if (isLast) "Let's go!" else "Next",
                        style = MaterialTheme.typography.labelLarge
                    )
                }

                // Skip — subdued text button, not a filled button
                if (!isLast) {
                    TextButton(
                        onClick = onComplete,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Skip tour",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
