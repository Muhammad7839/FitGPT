/**
 * Login UI that authenticates users and navigates on successful token persistence.
 */
@file:Suppress("DEPRECATION")

package com.fitgpt.app.ui.auth

import android.app.Activity
import android.content.Context
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.data.network.BackendEnvironmentResolver
import com.fitgpt.app.ui.common.BrandingBackgroundLayer
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.AuthState
import com.fitgpt.app.viewmodel.AuthViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Tasks
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val GOOGLE_AUTH_LOG_TAG = "GOOGLE_AUTH"
private const val GOOGLE_AUTH_DEBUG_LOG_TAG = "GOOGLE_AUTH_DEBUG"

fun debugGoogleConfig(context: Context) {
    val account = GoogleSignIn.getLastSignedInAccount(context)
    Log.d(GOOGLE_AUTH_DEBUG_LOG_TAG, "last_account_present=${account != null}")
}

private suspend fun clearGoogleSignInSession(client: GoogleSignInClient): Boolean {
    return withContext(Dispatchers.IO) {
        runCatching {
            Tasks.await(client.signOut())
            true
        }.getOrDefault(false)
    }
}

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
    var googleErrorMessage by remember { mutableStateOf<String?>(null) }
    var currentGoogleAttemptId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val googleClientId = BuildConfig.GOOGLE_CLIENT_ID
    val showQuickLoginDev = remember {
        BuildConfig.DEBUG && runCatching {
            val activeBaseUrl = BackendEnvironmentResolver.resolveBaseUrl(
                apiBaseUrl = BuildConfig.API_BASE_URL,
                physicalLanBaseUrl = BuildConfig.API_LAN_BASE_URL
            )
            BackendEnvironmentResolver.isLocalDevelopmentBaseUrl(activeBaseUrl)
        }.getOrDefault(false)
    }

    val googleSignInClient = remember(context, googleClientId) {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestIdToken(BuildConfig.GOOGLE_CLIENT_ID)
            .build()

        GoogleSignIn.getClient(context, gso)
    }

    LaunchedEffect(context) {
        debugGoogleConfig(context)
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val attemptId = currentGoogleAttemptId ?: UUID.randomUUID().toString()
        currentGoogleAttemptId = attemptId
        Log.d(GOOGLE_AUTH_LOG_TAG, "attempt_id=$attemptId callback triggered")
        Log.d(GOOGLE_AUTH_LOG_TAG, "attempt_id=$attemptId resultCode=${result.resultCode}")
        val data = result.data

        if (result.resultCode != Activity.RESULT_OK) {
            val failure = resolveGoogleSignInOutcome(
                resultCode = result.resultCode,
                accountPresent = false,
                email = null,
                idToken = null
            ) as GoogleSignInOutcome.Failure
            Log.w(GOOGLE_AUTH_LOG_TAG, "attempt_id=$attemptId result handling failure=${failure.reason}")
            googleErrorMessage = failure.userMessage
            currentGoogleAttemptId = null
            return@rememberLauncherForActivityResult
        }

        val task = GoogleSignIn.getSignedInAccountFromIntent(data)

        try {
            val account = task.getResult(ApiException::class.java)
            val outcome = resolveGoogleSignInOutcome(
                resultCode = result.resultCode,
                accountPresent = account != null,
                email = account?.email,
                idToken = account?.idToken
            )

            when (outcome) {
                is GoogleSignInOutcome.Success -> {
                    Log.d(GOOGLE_AUTH_LOG_TAG, "attempt_id=$attemptId idToken_present=true")
                    googleErrorMessage = null
                    viewModel.loginWithGoogleToken(
                        idToken = outcome.idToken,
                        attemptId = attemptId
                    )
                }

                is GoogleSignInOutcome.Failure -> {
                    Log.d(GOOGLE_AUTH_LOG_TAG, "attempt_id=$attemptId idToken_present=${outcome.tokenPresent}")
                    Log.w(
                        GOOGLE_AUTH_LOG_TAG,
                        "attempt_id=$attemptId result handling failure=${outcome.reason}"
                    )
                    googleErrorMessage = outcome.userMessage
                    currentGoogleAttemptId = null
                    if (outcome.shouldClearClientSession) {
                        scope.launch {
                            val cleared = clearGoogleSignInSession(googleSignInClient)
                            Log.i(
                                GOOGLE_AUTH_LOG_TAG,
                                "attempt_id=$attemptId cleared stale Google session=$cleared reason=${outcome.reason}"
                            )
                        }
                    }
                }
            }
        } catch (e: ApiException) {
            val failure = resolveGoogleSignInApiException(e.statusCode)
            Log.e(
                GOOGLE_AUTH_LOG_TAG,
                "attempt_id=$attemptId Google Sign-In ApiException status=${e.statusCode} message=${e.message.orEmpty()}"
            )
            googleErrorMessage = failure.userMessage
            currentGoogleAttemptId = null
            if (failure.shouldClearClientSession) {
                scope.launch {
                    val cleared = clearGoogleSignInSession(googleSignInClient)
                    Log.i(
                        GOOGLE_AUTH_LOG_TAG,
                        "attempt_id=$attemptId cleared stale Google session=$cleared reason=${failure.reason}"
                    )
                }
            }
        }
    }

    LaunchedEffect(state, currentGoogleAttemptId) {
        val attemptId = currentGoogleAttemptId
        if (state is AuthState.Success) {
            currentGoogleAttemptId = null
            onLoginSuccess(attemptId)
        } else if (state is AuthState.Error && attemptId != null) {
            currentGoogleAttemptId = null
            val cleared = clearGoogleSignInSession(googleSignInClient)
            Log.i(
                GOOGLE_AUTH_LOG_TAG,
                "attempt_id=$attemptId cleared stale Google session=$cleared after backend failure"
            )
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
