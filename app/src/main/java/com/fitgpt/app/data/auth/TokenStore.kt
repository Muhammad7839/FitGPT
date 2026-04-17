/**
 * Persists authentication tokens in DataStore for reuse across app launches.
 */
package com.fitgpt.app.data.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.fitgpt.app.data.dataStore
import com.fitgpt.app.data.remote.dto.TokenResponse
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class TokenStore(
    private val context: Context
) : AuthSessionStore {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val tokenTypeKey = stringPreferencesKey("token_type")

    override suspend fun saveToken(token: TokenResponse) {
        context.dataStore.edit { preferences ->
            preferences[accessTokenKey] = token.accessToken
            preferences[tokenTypeKey] = token.tokenType
        }
    }

    override suspend fun clearToken() {
        context.dataStore.edit { preferences ->
            preferences.remove(accessTokenKey)
            preferences.remove(tokenTypeKey)
        }
    }

    override suspend fun getAccessToken(): String? {
        return context.dataStore.data
            .map { preferences -> preferences[accessTokenKey] }
            .first()
    }
}
