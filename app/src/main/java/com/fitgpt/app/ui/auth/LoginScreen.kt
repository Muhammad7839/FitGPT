/**
 * Login UI that authenticates users and navigates on successful token persistence.
 */
@file:Suppress("DEPRECATION")

package com.fitgpt.app.ui.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.data.network.BackendEnvironmentResolver
import com.fitgpt.app.ui.common.BrandingBackgroundLayer
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel

/**
 * Simple auth entry screen that saves JWT token via AuthViewModel on success.
 */
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: (String?) -> Unit,
    onCreateAccountClick: () -> Unit,
    onForgotPasswordClick: () -> Unit,
    initialEmail: String = "",
    infoMessage: String? = null
) {
    val state by viewModel.loginState.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val showQuickLoginDev = remember {
        BuildConfig.DEBUG && runCatching {
            val activeBaseUrl = BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = BuildConfig.API_BASE_URL,
                physicalLanBaseUrl = BuildConfig.API_LAN_BASE_URL
            )
            BackendEnvironmentResolver.isLocalDevelopmentBaseUrl(activeBaseUrl)
        }.getOrDefault(false)
    }

    LaunchedEffect(state) {
        if (state is AuthState.Success) {
            onLoginSuccess(null)
        }
    }

    LaunchedEffect(initialEmail) {
        if (email.isBlank() && initialEmail.isNotBlank()) {
            email = initialEmail
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        BrandingBackgroundLayer(logoOpacity = 0.07f)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Welcome Back",
                style = MaterialTheme.typography.headlineMedium
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Sign in to keep your wardrobe and recommendations in sync.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(24.dp))

            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Sign in",
                        style = MaterialTheme.typography.headlineSmall
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Welcome back. Let's get you styled.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = { viewModel.login(email = email.trim(), password = password) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        if (state is AuthState.Loading) {
                            CircularProgressIndicator()
                        } else {
                            Text("Sign In")
                        }
                    }

                    if (showQuickLoginDev) {
                        Spacer(modifier = Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = { viewModel.quickLoginDev() },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state !is AuthState.Loading
                        ) {
                            Text("Quick Login (Dev)")
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(10.dp))

                    // Create account — prominent secondary action (outlined, not filled)
                    OutlinedButton(
                        onClick = onCreateAccountClick,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        Text("Create account")
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Forgot password — low-emphasis tertiary action (text only)
                    TextButton(
                        onClick = onForgotPasswordClick,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        Text(
                            text = "Forgot password?",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    if (!infoMessage.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = infoMessage,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    if (state is AuthState.Error) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = (state as AuthState.Error).message,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}
