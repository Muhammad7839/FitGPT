/**
 * ViewModel for login actions and auth session state.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.auth.TokenStore
import com.fitgpt.app.data.repository.AuthRepository
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
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
    private val tokenStore: TokenStore
) : ViewModel() {

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
                tokenStore.saveToken(token)
                _loginState.value = AuthState.Success
            } catch (e: HttpException) {
                val message = if (e.code() == 401) {
                    "Invalid email or password"
                } else {
                    "Login failed (${e.code()})"
                }
                _loginState.value = AuthState.Error(message)
            } catch (e: Exception) {
                _loginState.value = AuthState.Error(resolveNetworkAuthError(e, action = "login"))
            }
        }
    }

    fun loginWithGoogleToken(idToken: String) {
        if (idToken.isBlank()) {
            _loginState.value = AuthState.Error("Google ID token is required")
            return
        }

        _loginState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val token = repository.loginWithGoogle(idToken)
                tokenStore.saveToken(token)
                _loginState.value = AuthState.Success
            } catch (e: HttpException) {
                _loginState.value = AuthState.Error("Google login failed (${e.code()})")
            } catch (e: Exception) {
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
                val token = repository.login(email = normalizedEmail, password = password)
                tokenStore.saveToken(token)
                _registerState.value = AuthState.Success
            } catch (e: HttpException) {
                val message = when (e.code()) {
                    400 -> "Registration failed (email may already exist)"
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

    private fun normalizeEmail(email: String): String {
        return email.trim().lowercase(Locale.ROOT)
    }
}
