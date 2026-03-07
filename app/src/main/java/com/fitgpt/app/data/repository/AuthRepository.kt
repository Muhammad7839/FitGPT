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
    suspend fun hasValidSession(): Boolean
}
