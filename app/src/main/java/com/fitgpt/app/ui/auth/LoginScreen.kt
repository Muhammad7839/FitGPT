package com.fitgpt.app.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    authViewModel: AuthViewModel,
    onAuthenticated: () -> Unit
) {
    val isLoading by authViewModel.isLoading.collectAsState()
    val errorMessage by authViewModel.errorMessage.collectAsState()
    val isAuthenticated by authViewModel.isAuthenticated.collectAsState()

    var isRegisterMode by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var guestName by remember { mutableStateOf("") }

    LaunchedEffect(isAuthenticated) {
        if (isAuthenticated) {
            onAuthenticated()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("FitGPT") })
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = if (isRegisterMode) "Create Account" else "Sign In",
                style = MaterialTheme.typography.headlineSmall
            )

            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            if (isRegisterMode) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation()
            )

            Button(
                onClick = {
                    if (isRegisterMode) {
                        authViewModel.register(name, email, password)
                    } else {
                        authViewModel.login(email, password)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading && email.isNotBlank() && password.isNotBlank()
                        && (!isRegisterMode || name.isNotBlank())
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(if (isRegisterMode) "Register" else "Sign In")
                }
            }

            TextButton(onClick = {
                isRegisterMode = !isRegisterMode
                authViewModel.clearError()
            }) {
                Text(
                    if (isRegisterMode) "Already have an account? Sign In"
                    else "Don't have an account? Register"
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

            Text(
                text = "Or continue as guest",
                style = MaterialTheme.typography.bodyMedium
            )

            OutlinedTextField(
                value = guestName,
                onValueChange = { guestName = it },
                label = { Text("Guest Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedButton(
                onClick = { authViewModel.guestLogin(guestName) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading && guestName.isNotBlank()
            ) {
                Text("Continue as Guest")
            }
        }
    }
}
