package com.fitgpt.app.viewmodel

import com.fitgpt.app.data.auth.AuthSessionStore
import com.fitgpt.app.data.remote.dto.TokenResponse
import com.fitgpt.app.data.repository.AuthRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun loginWithGoogleToken_success_persistsSessionAndSetsSuccess() = runTest(dispatcher) {
        val repository = FakeAuthRepository()
        val sessionStore = FakeSessionStore()
        val viewModel = AuthViewModel(repository, sessionStore)

        viewModel.loginWithGoogleToken(
            idToken = "token-12345678901234567890",
            attemptId = "attempt-1"
        )
        advanceUntilIdle()

        assertEquals("token-12345678901234567890", repository.lastGoogleToken)
        assertEquals("attempt-1", repository.lastAttemptId)
        assertEquals("jwt-token", sessionStore.accessToken)
        assertTrue(viewModel.loginState.value is AuthState.Success)
    }

    @Test
    fun loginWithGoogleToken_missingToken_returnsConfigErrorWithoutCallingBackend() = runTest(dispatcher) {
        val repository = FakeAuthRepository()
        val sessionStore = FakeSessionStore()
        val viewModel = AuthViewModel(repository, sessionStore)

        viewModel.loginWithGoogleToken(
            idToken = "",
            attemptId = "attempt-2"
        )
        advanceUntilIdle()

        assertEquals(null, repository.lastGoogleToken)
        assertTrue(viewModel.loginState.value is AuthState.Error)
        assertEquals(
            "Google Sign-In failed: ID token missing (check client ID / SHA-1 config)",
            (viewModel.loginState.value as AuthState.Error).message
        )
    }

    @Test
    fun loginWithGoogleToken_backendFailure_keepsUserLoggedOutAndDoesNotReportCancelled() = runTest(dispatcher) {
        val repository = FakeAuthRepository().apply {
            googleFailure = httpException(400, "Invalid Google token audience")
        }
        val sessionStore = FakeSessionStore()
        val viewModel = AuthViewModel(repository, sessionStore)

        viewModel.loginWithGoogleToken(
            idToken = "token-12345678901234567890",
            attemptId = "attempt-3"
        )
        advanceUntilIdle()

        assertEquals(null, sessionStore.accessToken)
        assertTrue(viewModel.loginState.value is AuthState.Error)
        assertTrue((viewModel.loginState.value as AuthState.Error).message.contains("failed"))
        assertTrue(!(viewModel.loginState.value as AuthState.Error).message.contains("cancelled"))
    }

    private fun httpException(code: Int, detail: String): HttpException {
        val body = """{"detail":"$detail"}"""
            .toResponseBody("application/json".toMediaType())
        return HttpException(Response.error<Any>(code, body))
    }
}

private class FakeAuthRepository : AuthRepository {
    var lastGoogleToken: String? = null
    var lastAttemptId: String? = null
    var googleFailure: Exception? = null

    override suspend fun login(email: String, password: String): TokenResponse {
        return TokenResponse(accessToken = "email-token", tokenType = "bearer")
    }

    override suspend fun register(email: String, password: String) = Unit

    override suspend fun loginWithGoogle(idToken: String, attemptId: String?): TokenResponse {
        lastGoogleToken = idToken
        lastAttemptId = attemptId
        googleFailure?.let { throw it }
        return TokenResponse(accessToken = "jwt-token", tokenType = "bearer")
    }

    override suspend fun forgotPassword(email: String): Pair<String, String?> {
        return "ok" to null
    }

    override suspend fun resetPassword(token: String, newPassword: String): String {
        return "ok"
    }

    override suspend fun hasValidSession(): Boolean {
        return false
    }
}

private class FakeSessionStore : AuthSessionStore {
    var accessToken: String? = null

    override suspend fun saveToken(token: TokenResponse) {
        accessToken = token.accessToken
    }

    override suspend fun clearToken() {
        accessToken = null
    }

    override suspend fun getAccessToken(): String? {
        return accessToken
    }
}
