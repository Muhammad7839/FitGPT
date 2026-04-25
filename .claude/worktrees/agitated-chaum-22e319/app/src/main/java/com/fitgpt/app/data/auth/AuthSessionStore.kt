package com.fitgpt.app.data.auth

import com.fitgpt.app.data.remote.dto.TokenResponse

/**
 * Minimal session persistence contract used by auth flows and tests.
 */
interface AuthSessionStore {
    suspend fun saveToken(token: TokenResponse)
    suspend fun clearToken()
    suspend fun getAccessToken(): String?
}
