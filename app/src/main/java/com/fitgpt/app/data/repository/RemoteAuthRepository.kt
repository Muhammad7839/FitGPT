package com.fitgpt.app.data.repository

import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.remote.dto.ForgotPasswordRequest
import com.fitgpt.app.data.remote.dto.GoogleLoginRequest
import com.fitgpt.app.data.remote.dto.RegisterRequest
import com.fitgpt.app.data.remote.dto.ResetPasswordRequest
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

    override suspend fun register(email: String, password: String) {
        api.register(
            RegisterRequest(
                email = email,
                password = password
            )
        )
    }

    override suspend fun loginWithGoogle(idToken: String): TokenResponse {
        return api.loginWithGoogle(
            GoogleLoginRequest(idToken = idToken)
        )
    }

    override suspend fun forgotPassword(email: String): Pair<String, String?> {
        val response = api.forgotPassword(
            ForgotPasswordRequest(email = email)
        )
        return response.detail to response.resetToken
    }

    override suspend fun resetPassword(token: String, newPassword: String): String {
        val response = api.resetPassword(
            ResetPasswordRequest(
                token = token,
                newPassword = newPassword
            )
        )
        return response.detail
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
