package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.remote.FitGptApi
import com.fitgpt.app.data.remote.TokenManager
import com.fitgpt.app.data.remote.dto.GuestRequest
import com.fitgpt.app.data.remote.dto.LoginRequest
import com.fitgpt.app.data.remote.dto.RegisterRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val api: FitGptApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    private val _isAuthenticated = MutableStateFlow(tokenManager.hasToken())
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val response = api.login(LoginRequest(email, password))
                tokenManager.token = response.token
                _isAuthenticated.value = true
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Login failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val response = api.register(RegisterRequest(name, email, password))
                tokenManager.token = response.token
                _isAuthenticated.value = true
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Registration failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun guestLogin(name: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val response = api.guestLogin(GuestRequest(name))
                tokenManager.token = response.token
                _isAuthenticated.value = true
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Guest login failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun logout() {
        tokenManager.clearToken()
        _isAuthenticated.value = false
    }

    fun clearError() {
        _errorMessage.value = null
    }
}

class AuthViewModelFactory(
    private val api: FitGptApi,
    private val tokenManager: TokenManager
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            return AuthViewModel(api, tokenManager) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
