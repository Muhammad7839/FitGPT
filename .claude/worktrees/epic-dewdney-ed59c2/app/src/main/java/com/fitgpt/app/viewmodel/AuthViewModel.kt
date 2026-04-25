/**
 * ViewModel for login actions and auth session state.
 */
package com.fitgpt.app.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.data.auth.AuthSessionStore
import com.fitgpt.app.data.repository.AuthRepository
import com.fitgpt.app.data.repository.ProfileRepository
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.HttpException

/**
 * Owns authentication state and persists JWT tokens after successful login.
 */
sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    object Success : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel(
    private val repository: AuthRepository,
    private val tokenStore: AuthSessionStore,
    private val profileRepository: ProfileRepository? = null,
) : ViewModel() {
    companion object {
        private const val DEV_QUICK_LOGIN_EMAIL = "dev.quicklogin@example.com"
        private const val DEV_QUICK_LOGIN_PASSWORD = "Test1234"
    }

    private val authLogTag = "GOOGLE_AUTH"

    private val _loginState = MutableStateFlow<AuthState>(AuthState.Idle)
    val loginState: StateFlow<AuthState> = _loginState

    private val _registerState = MutableStateFlow<AuthState>(AuthState.Idle)
    val registerState: StateFlow<AuthState> = _registerState

    private val _forgotPasswordState = MutableStateFlow<AuthState>(AuthState.Idle)
    val forgotPasswordState: StateFlow<AuthState> = _forgotPasswordState

    private val _resetPasswordState = MutableStateFlow<AuthState>(AuthState.Idle)
    val resetPasswordState: StateFlow<AuthState> = _resetPasswordState

    private val _lastResetToken = MutableStateFlow<String?>(null)
    val lastResetToken: StateFlow<String?> = _lastResetToken

    fun login(email: String, password: String) {
        val normalizedEmail = normalizeEmail(email)
        if (normalizedEmail.isBlank() || password.isBlank()) {
            _loginState.value = AuthState.Error("Email and password are required")
            return
        }

        _loginState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val token = repository.login(email = normalizedEmail, password = password)
                if (persistSession(token)) {
                    _loginState.value = AuthState.Success
                } else {
                    _loginState.value = AuthState.Error("Unable to save your session. Please try again.")
                }
            } catch (e: HttpException) {
                val message = if (e.code() == 401) {
                    "Incorrect email or password. If this account already exists, try resetting your password."
                } else {
                    "Login failed (${e.code()})"
                }
                _loginState.value = AuthState.Error(message)
            } catch (e: Exception) {
                _loginState.value = AuthState.Error(resolveNetworkAuthError(e, action = "login"))
            }
        }
    }

    fun quickLoginDev() {
        if (!BuildConfig.DEBUG) {
            return
        }

        _loginState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                Log.d(authLogTag, "DEV_QUICK_LOGIN attempting login")
                val token = try {
                    repository.login(
                        email = DEV_QUICK_LOGIN_EMAIL,
                        password = DEV_QUICK_LOGIN_PASSWORD
                    )
                } catch (exception: HttpException) {
                    if (exception.code() != 401) {
                        throw exception
                    }

                    Log.d(authLogTag, "DEV_QUICK_LOGIN account missing or rejected; attempting registration")
                    try {
                        repository.register(
                            email = DEV_QUICK_LOGIN_EMAIL,
                            password = DEV_QUICK_LOGIN_PASSWORD
                        )
                    } catch (registerException: HttpException) {
                        if (registerException.code() != 400) {
                            throw registerException
                        }
                    }

                    repository.login(
                        email = DEV_QUICK_LOGIN_EMAIL,
                        password = DEV_QUICK_LOGIN_PASSWORD
                    )
                }

                if (persistSession(token)) {
                    ensureDevQuickLoginOnboardingComplete()
                    _loginState.value = AuthState.Success
                } else {
                    _loginState.value = AuthState.Error("Unable to save your session. Please try again.")
                }
            } catch (exception: HttpException) {
                val message = if (exception.code() == 401) {
                    "Quick login failed. Reset the dev account or clear local backend data."
                } else {
                    "Quick login failed (${exception.code()})"
                }
                _loginState.value = AuthState.Error(message)
            } catch (exception: Exception) {
                _loginState.value = AuthState.Error(
                    resolveNetworkAuthError(exception, action = "debug quick login")
                )
            }
        }
    }

    fun loginWithGoogleToken(idToken: String, attemptId: String) {
        Log.d(authLogTag, "attempt_id=$attemptId idToken_present=${idToken.isNotBlank()}")
        if (idToken.isBlank()) {
            Log.e(
                authLogTag,
                "attempt_id=$attemptId CONFIG_ERROR: ID_TOKEN_NULL"
            )
            Log.e(
                authLogTag,
                "attempt_id=$attemptId Google ID token missing before backend call"
            )
            _loginState.value = AuthState.Error(
                "Google Sign-In failed: ID token missing (check client ID / SHA-1 config)"
            )
            return
        }

        _loginState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                Log.i(authLogTag, "attempt_id=$attemptId sending token to backend")
                val token = repository.loginWithGoogle(idToken = idToken, attemptId = attemptId)
                Log.i(authLogTag, "attempt_id=$attemptId backend login success")
                val persisted = persistSession(token)
                Log.i(authLogTag, "attempt_id=$attemptId session persisted=$persisted")
                if (persisted) {
                    _loginState.value = AuthState.Success
                } else {
                    _loginState.value = AuthState.Error("Unable to save your session. Please try again.")
                }
            } catch (e: HttpException) {
                val responseDetail = extractHttpDetail(e)
                Log.w(
                    authLogTag,
                    "attempt_id=$attemptId backend login failure code=${e.code()} detail=${responseDetail.orEmpty()}"
                )
                val message = when {
                    e.code() == 401 && !responseDetail.isNullOrBlank() -> responseDetail
                    e.code() == 401 -> "Google sign-in expired. Please try again."
                    !responseDetail.isNullOrBlank() -> responseDetail
                    e.code() == 400 -> "Google sign-in failed. Please try again."
                    else -> "Google sign-in failed. Please try again."
                }
                _loginState.value = AuthState.Error(message)
            } catch (e: Exception) {
                Log.e(
                    authLogTag,
                    "attempt_id=$attemptId backend login failure ${e::class.java.simpleName}: ${e.message.orEmpty()}"
                )
                _loginState.value = AuthState.Error(resolveNetworkAuthError(e, action = "Google login"))
            }
        }
    }

    fun register(email: String, password: String, confirmPassword: String) {
        val normalizedEmail = normalizeEmail(email)
        if (normalizedEmail.isBlank() || password.isBlank()) {
            _registerState.value = AuthState.Error("Email and password are required")
            return
        }
        if (password != confirmPassword) {
            _registerState.value = AuthState.Error("Passwords do not match")
            return
        }
        if (password.length < 6) {
            _registerState.value = AuthState.Error("Password must be at least 6 characters")
            return
        }

        _registerState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                repository.register(email = normalizedEmail, password = password)
                _registerState.value = AuthState.Success
            } catch (e: HttpException) {
                val message = when (e.code()) {
                    400 -> "An account with this email already exists. Sign in instead or reset your password."
                    else -> "Registration failed (${e.code()})"
                }
                _registerState.value = AuthState.Error(message)
            } catch (e: Exception) {
                _registerState.value = AuthState.Error(resolveNetworkAuthError(e, action = "registration"))
            }
        }
    }

    fun forgotPassword(email: String) {
        val normalizedEmail = normalizeEmail(email)
        if (normalizedEmail.isBlank()) {
            _forgotPasswordState.value = AuthState.Error("Email is required")
            return
        }

        _forgotPasswordState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val (_, resetToken) = repository.forgotPassword(normalizedEmail)
                _lastResetToken.value = resetToken
                _forgotPasswordState.value = AuthState.Success
            } catch (e: HttpException) {
                _forgotPasswordState.value = AuthState.Error("Forgot password failed (${e.code()})")
            } catch (e: Exception) {
                _forgotPasswordState.value = AuthState.Error(resolveNetworkAuthError(e, action = "forgot password"))
            }
        }
    }

    fun resetPassword(token: String, newPassword: String, confirmPassword: String) {
        if (token.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
            _resetPasswordState.value = AuthState.Error("All fields are required")
            return
        }
        if (newPassword != confirmPassword) {
            _resetPasswordState.value = AuthState.Error("Passwords do not match")
            return
        }
        if (newPassword.length < 6) {
            _resetPasswordState.value = AuthState.Error("Password must be at least 6 characters")
            return
        }

        _resetPasswordState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                repository.resetPassword(token, newPassword)
                _resetPasswordState.value = AuthState.Success
            } catch (e: HttpException) {
                _resetPasswordState.value = AuthState.Error("Reset failed (${e.code()})")
            } catch (e: Exception) {
                _resetPasswordState.value = AuthState.Error(resolveNetworkAuthError(e, action = "reset password"))
            }
        }
    }

    private fun resolveNetworkAuthError(exception: Exception, action: String): String {
        return when (exception) {
            is UnknownHostException -> "No internet or host not found during $action"
            is ConnectException -> "Cannot reach backend during $action (check server is running)"
            is SocketTimeoutException -> "Backend timeout during $action"
            is IOException -> "Network I/O error during $action"
            else -> "Unexpected network error during $action"
        }
    }

    private suspend fun persistSession(token: com.fitgpt.app.data.remote.dto.TokenResponse): Boolean {
        tokenStore.saveToken(token)
        return !tokenStore.getAccessToken().isNullOrBlank()
    }

    private suspend fun ensureDevQuickLoginOnboardingComplete() {
        val repository = profileRepository ?: return
        val profile = repository.getProfile()
        if (profile.onboardingComplete) {
            return
        }

        Log.d(authLogTag, "DEV_QUICK_LOGIN completing onboarding for dedicated dev account")
        repository.completeOnboarding(
            stylePreferences = emptyList(),
            comfortPreferences = emptyList(),
            dressFor = emptyList(),
            bodyType = null,
            gender = null,
            heightCm = null
        )
    }

    private fun extractHttpDetail(exception: HttpException): String? {
        val payload = runCatching {
            exception.response()?.errorBody()?.string().orEmpty()
        }.getOrNull().orEmpty()
        if (payload.isBlank()) {
            return null
        }
        val detail = runCatching {
            JSONObject(payload).optString("detail")
        }.getOrNull().orEmpty().trim()
        return detail.ifBlank { null }
    }

    private fun normalizeEmail(email: String): String {
        return email.trim().lowercase(Locale.ROOT)
    }
}
