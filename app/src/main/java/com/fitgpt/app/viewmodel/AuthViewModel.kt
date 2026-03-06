package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.auth.TokenStore
import com.fitgpt.app.data.repository.AuthRepository
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

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _loginState.value = AuthState.Error("Email and password are required")
            return
        }

        _loginState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val token = repository.login(email = email, password = password)
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
                _loginState.value = AuthState.Error("Network error during login")
            }
        }
    }
}
