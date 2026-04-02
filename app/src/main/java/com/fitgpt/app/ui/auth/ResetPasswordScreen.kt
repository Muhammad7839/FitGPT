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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel

/**
 * Reset-password screen backed by backend token reset endpoint.
 */
@Composable
fun ResetPasswordScreen(
    navController: NavController,
    viewModel: AuthViewModel,
    initialToken: String = ""
) {
    var token by remember { mutableStateOf(initialToken) }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    val state by viewModel.resetPasswordState.collectAsState()

    LaunchedEffect(initialToken) {
        if (initialToken.isNotBlank()) token = initialToken
    }

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
                Text("Reset Password", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Enter the reset token and a new password.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("Reset token") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("New password") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Confirm password") },
                    modifier = Modifier.fillMaxWidth()
                )

                Button(
                    onClick = {
                        viewModel.resetPassword(
                            token = token.trim(),
                            newPassword = newPassword,
                            confirmPassword = confirmPassword
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Reset")
                }

                when (state) {
                    AuthState.Loading -> Text("Submitting...")
                    is AuthState.Error -> Text(
                        (state as AuthState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                    AuthState.Success -> {
                        Text(
                            "Password reset successful. You can sign in now.",
                            color = MaterialTheme.colorScheme.primary
                        )
                        Button(onClick = { navController.popBackStack() }, modifier = Modifier.fillMaxWidth()) {
                            Text("Back to sign in")
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
