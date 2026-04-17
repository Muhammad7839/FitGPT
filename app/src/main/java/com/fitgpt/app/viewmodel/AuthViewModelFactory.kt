/**
 * Factory for AuthViewModel dependency injection.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.fitgpt.app.data.auth.AuthSessionStore
import com.fitgpt.app.data.repository.AuthRepository

/**
 * Factory for creating AuthViewModel with injected repositories.
 */
class AuthViewModelFactory(
    private val repository: AuthRepository,
    private val tokenStore: AuthSessionStore
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AuthViewModel(repository, tokenStore) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
