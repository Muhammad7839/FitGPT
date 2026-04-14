/**
 * Login UI that authenticates users and navigates on successful token persistence.
 */
@file:Suppress("DEPRECATION")

package com.fitgpt.app.ui.auth

import android.app.Activity
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.ui.common.BrandingBackgroundLayer
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

private const val GOOGLE_AUTH_LOG_TAG = "FitGPTGoogleAuth"

/**
 * Simple auth entry screen that saves JWT token via AuthViewModel on success.
 */
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onLoginSuccess: () -> Unit,
    onCreateAccountClick: () -> Unit,
    onForgotPasswordClick: () -> Unit,
    onContinueAsGuestClick: () -> Unit,
    initialEmail: String = "",
    infoMessage: String? = null
) {
    val state by viewModel.loginState.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var googleErrorMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val googleClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
    val showGoogleSignIn = shouldShowGoogleSignInButton(googleClientId)

    val googleSignInClient = remember(context, googleClientId) {
        val optionsBuilder = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
        if (showGoogleSignIn) {
            optionsBuilder.requestIdToken(googleClientId)
        }
        val options = optionsBuilder.build()
        GoogleSignIn.getClient(context, options)
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val signInTask = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = signInTask.getResult(ApiException::class.java)
            when (
                val outcome = resolveGoogleSignInOutcome(
                    resultCode = result.resultCode,
                    accountPresent = account != null,
                    email = account?.email,
                    idToken = account?.idToken
                )
            ) {
                is GoogleSignInOutcome.Success -> {
                    Log.i(
                        GOOGLE_AUTH_LOG_TAG,
                        "Google success: resultCode=${result.resultCode}, email=${outcome.email.orEmpty()}, token=present"
                    )
                    googleErrorMessage = null
                    viewModel.loginWithGoogleToken(outcome.idToken)
                }

                is GoogleSignInOutcome.Failure -> {
                    Log.w(
                        GOOGLE_AUTH_LOG_TAG,
                        "Google failed: resultCode=${result.resultCode}, email=${outcome.email.orEmpty()}, tokenPresent=${outcome.tokenPresent}, reason=${outcome.reason}"
                    )
                    googleErrorMessage = outcome.userMessage
                }
            }
        } catch (exception: ApiException) {
            Log.w(
                GOOGLE_AUTH_LOG_TAG,
                "Google failed: resultCode=${result.resultCode}, reason=api_exception_${exception.statusCode}"
            )
            googleErrorMessage = "Google sign-in failed"
        }
    }

    LaunchedEffect(state) {
        if (state is AuthState.Success) {
            onLoginSuccess()
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

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider()
                    if (showGoogleSignIn) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                googleErrorMessage = null
                                googleSignInLauncher.launch(googleSignInClient.signInIntent)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = state !is AuthState.Loading
                        ) {
                            Text("Sign in with Google")
                        }
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

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedButton(
                        onClick = onContinueAsGuestClick,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = state !is AuthState.Loading
                    ) {
                        Text("Try AURA without signing in")
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
}
