/**
 * Visual post-login tutorial shown once to explain the core FitGPT flows.
 */
package com.fitgpt.app.ui.onboarding

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.fitgpt.app.R
import com.fitgpt.app.ui.common.WebCard

private data class TutorialPage(
    val title: String,
    val message: String
)

private val tutorialPages = listOf(
    TutorialPage(
        title = "Upload your clothes",
        message = "Start with Wardrobe and add clear photos so FitGPT can build better outfit suggestions."
    ),
    TutorialPage(
        title = "Get recommendations",
        message = "Open Recommend to get weather-aware outfit ideas based on your available items."
    ),
    TutorialPage(
        title = "Ask AI chat anytime",
        message = "Use the AI chat button on main tabs for quick style help without leaving your flow."
    )
)

@Composable
fun PostLoginTutorialScreen(
    onComplete: () -> Unit
) {
    var pageIndex by remember { mutableIntStateOf(0) }
    val page = tutorialPages[pageIndex]
    val isLast = pageIndex == tutorialPages.lastIndex
    val pulseTransition = rememberInfiniteTransition(label = "tutorial-pulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1600),
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
                .padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "FitGPT quick tour",
                    style = MaterialTheme.typography.headlineMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Step ${pageIndex + 1} of ${tutorialPages.size}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            WebCard(
                modifier = Modifier.fillMaxWidth(),
                accentTop = false
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.fitgpt_brand_background),
                        contentDescription = "FitGPT",
                        modifier = Modifier
                            .size(144.dp)
                            .scale(pulseScale)
                    )
                    Text(
                        text = page.title,
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        text = page.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    tutorialPages.forEachIndexed { index, _ ->
                        Box(
                            modifier = Modifier
                                .padding(horizontal = 4.dp)
                                .size(if (index == pageIndex) 10.dp else 8.dp)
                                .background(
                                    color = if (index == pageIndex) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.outline.copy(alpha = 0.45f)
                                    },
                                    shape = CircleShape
                                )
                        )
                    }
                }

                Button(
                    onClick = {
                        if (isLast) {
                            onComplete()
                        } else {
                            pageIndex += 1
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text(if (isLast) "Finish tutorial" else "Next")
                }

                Button(
                    onClick = onComplete,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Skip")
                }
            }
        }
    }
}
