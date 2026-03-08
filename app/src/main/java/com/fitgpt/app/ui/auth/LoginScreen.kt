/**
 * Login UI that authenticates users and navigates on successful token persistence.
 */
package com.fitgpt.app.ui.auth

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.Image
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.R
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

/**
 * Simple auth entry screen that saves JWT token via AuthViewModel on success.
 */
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onCreateAccountClick: () -> Unit,
    onForgotPasswordClick: () -> Unit
) {
    val state by viewModel.loginState.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var googleErrorMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val googleClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID

    val googleSignInClient = remember(context, googleClientId) {
        val optionsBuilder = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
        if (googleClientId.isNotBlank()) {
            optionsBuilder.requestIdToken(googleClientId)
        }
        val options = optionsBuilder.build()
        GoogleSignIn.getClient(context, options)
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) {
            googleErrorMessage = "Google sign-in cancelled"
            return@rememberLauncherForActivityResult
        }
        val signInTask = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = signInTask.getResult(ApiException::class.java)
            val idToken = account?.idToken
            if (idToken.isNullOrBlank()) {
                googleErrorMessage = "Google sign-in did not return an ID token"
            } else {
                googleErrorMessage = null
                viewModel.loginWithGoogleToken(idToken)
            }
        } catch (_: ApiException) {
            googleErrorMessage = "Google sign-in failed"
        }
    }

    LaunchedEffect(state) {
        if (state is AuthState.Success) {
            onLoginSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Row {
            Image(
                painter = painterResource(id = R.drawable.official_logo),
                contentDescription = "FitGPT",
                modifier = Modifier.size(34.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "FitGPT",
                style = MaterialTheme.typography.titleLarge
            )
        }

        Spacer(modifier = Modifier.height(18.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Sign in",
                    style = MaterialTheme.typography.headlineMedium
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

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        if (googleClientId.isBlank()) {
                            googleErrorMessage = "Missing GOOGLE_WEB_CLIENT_ID in local.properties"
                        } else {
                            googleErrorMessage = null
                            googleSignInLauncher.launch(googleSignInClient.signInIntent)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state !is AuthState.Loading
                ) {
                    Text("Sign in with Google")
                }

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                    onClick = onForgotPasswordClick,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state !is AuthState.Loading
                ) {
                    Text("Forgot password")
                }

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                    onClick = onCreateAccountClick,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state !is AuthState.Loading
                ) {
                    Text("Create account")
                }

                if (state is AuthState.Error) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = (state as AuthState.Error).message,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                if (!googleErrorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = googleErrorMessage.orEmpty(),
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
