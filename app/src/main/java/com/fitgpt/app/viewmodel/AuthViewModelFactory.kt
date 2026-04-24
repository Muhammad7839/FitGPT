/**
 * Factory for AuthViewModel dependency injection.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.fitgpt.app.data.auth.AuthSessionStore
import com.fitgpt.app.data.repository.AuthRepository
import com.fitgpt.app.data.repository.ProfileRepository

/**
 * Factory for creating AuthViewModel with injected repositories.
 */
class AuthViewModelFactory(
    private val repository: AuthRepository,
    private val tokenStore: AuthSessionStore,
    private val profileRepository: ProfileRepository? = null,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AuthViewModel(repository, tokenStore, profileRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
