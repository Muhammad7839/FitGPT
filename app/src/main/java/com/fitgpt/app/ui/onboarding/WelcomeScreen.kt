/**
 * Introductory onboarding screen shown before authentication and wardrobe access.
 */
package com.fitgpt.app.ui.onboarding

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.fitgpt.app.R
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.viewmodel.OnboardingViewModel

@Composable
fun WelcomeScreen(
    navController: NavController,
    viewModel: OnboardingViewModel = viewModel()
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {

        Spacer(modifier = Modifier.height(8.dp))

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                painter = painterResource(id = R.drawable.official_logo),
                contentDescription = "FitGPT",
                modifier = Modifier.size(132.dp)
            )

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "Welcome to FitGPT",
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Your AI-powered outfit assistant that helps you look your best every day",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Button(
            onClick = {
                viewModel.markCompleted()

                navController.navigate(Routes.LOGIN) {
                    popUpTo(Routes.ONBOARDING_WELCOME) { inclusive = true }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Continue")
        }
    }
}
