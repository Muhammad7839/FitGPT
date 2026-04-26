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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.ui.common.BrandingBackgroundLayer
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel

/**
 * Email/password sign-up screen that returns users to login after success.
 */
@Composable
fun SignupScreen(
    viewModel: AuthViewModel,
    onSignupSuccess: (String) -> Unit,
    onBackToLoginClick: () -> Unit
) {
    val state by viewModel.registerState.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    LaunchedEffect(state) {
        if (state is AuthState.Success) {
            onSignupSuccess(email.trim())
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        BrandingBackgroundLayer(logoOpacity = 0.07f)
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement = Arrangement.Center
        ) {
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Create account",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Save your wardrobe and recommendations securely.",
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

                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Use at least 8 characters with a letter and a number.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Confirm password") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            viewModel.register(
                                email = email.trim(),
                                password = password,
                                confirmPassword = confirmPassword
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        if (state is AuthState.Loading) {
                            CircularProgressIndicator()
                        } else {
                            Text("Create account")
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Button(
                        onClick = onBackToLoginClick,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        Text("Back to sign in")
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
