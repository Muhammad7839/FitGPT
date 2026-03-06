package com.fitgpt.app.data.repository

import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.TokenResponse
import retrofit2.HttpException

/**
 * Remote auth implementation that delegates to Retrofit APIs.
 */
class RemoteAuthRepository(
    private val api: ApiService
) : AuthRepository {
    override suspend fun login(email: String, password: String): TokenResponse {
        return api.login(email = email, password = password)
    }

    override suspend fun hasValidSession(): Boolean {
        return try {
            api.getCurrentUser()
            true
        } catch (e: HttpException) {
            false
        } catch (e: Exception) {
            false
        }
    }
}
