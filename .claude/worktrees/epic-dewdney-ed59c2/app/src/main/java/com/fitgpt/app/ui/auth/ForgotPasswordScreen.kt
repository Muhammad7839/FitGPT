package com.fitgpt.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel

/**
 * Forgot-password screen backed by backend token generation.
 */
@Composable
fun ForgotPasswordScreen(
    navController: NavController,
    viewModel: AuthViewModel
) {
    var email by remember { mutableStateOf("") }
    val state by viewModel.forgotPasswordState.collectAsState()
    val generatedToken by viewModel.lastResetToken.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        WebCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Forgot Password", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Request a reset token for your account. In local testing, the token will appear here so you can reset inside the app.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth()
                )

                Button(
                    onClick = { viewModel.forgotPassword(email.trim()) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Submit")
                }

                when (state) {
                    AuthState.Loading -> Text("Submitting...")
                    is AuthState.Error -> Text(
                        (state as AuthState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                    AuthState.Success -> {
                        val token = generatedToken
                        if (!token.isNullOrBlank()) {
                            Text(
                                "Reset token generated. You can finish the reset here in the app.",
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "Token: $token",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Button(
                                onClick = { navController.navigate("${Routes.RESET_PASSWORD}?token=$token") },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Reset password now")
                            }
                        } else {
                            Text(
                                "If this account exists, reset instructions were issued.",
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                    AuthState.Idle -> Unit
                }
            }
        }

        Button(onClick = { navController.popBackStack() }, modifier = Modifier.fillMaxWidth()) {
            Text("Back")
        }
    }
}
