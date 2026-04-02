/**
 * Authentication data-access abstraction used by the auth ViewModel.
 */
package com.fitgpt.app.data.repository

import com.fitgpt.app.data.remote.dto.TokenResponse

/**
 * Handles authentication requests against backend auth endpoints.
 */
interface AuthRepository {
    suspend fun login(email: String, password: String): TokenResponse
    suspend fun register(email: String, password: String)
    suspend fun loginWithGoogle(idToken: String): TokenResponse
    suspend fun forgotPassword(email: String): Pair<String, String?>
    suspend fun resetPassword(token: String, newPassword: String): String
    suspend fun hasValidSession(): Boolean
}
