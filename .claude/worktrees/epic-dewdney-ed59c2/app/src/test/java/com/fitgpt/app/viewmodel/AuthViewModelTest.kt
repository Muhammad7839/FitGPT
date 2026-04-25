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

    @Test
    fun login_http401_returnsPasswordResetHint() = runTest(dispatcher) {
        val repository = FakeAuthRepository().apply {
            loginFailure = httpException(401, "Incorrect email or password")
        }
        val viewModel = AuthViewModel(repository, FakeSessionStore())

        viewModel.login("user@example.com", "wrong-password")
        advanceUntilIdle()

        assertEquals(
            "Incorrect email or password. If this account already exists, try resetting your password.",
            (viewModel.loginState.value as AuthState.Error).message
        )
    }

    @Test
    fun forgotPassword_http429_surfacesFailureCode() = runTest(dispatcher) {
        val repository = FakeAuthRepository().apply {
            forgotPasswordFailure = httpException(429, "Too many password reset requests")
        }
        val viewModel = AuthViewModel(repository, FakeSessionStore())

        viewModel.forgotPassword("user@example.com")
        advanceUntilIdle()

        assertEquals(
            "Forgot password failed (429)",
            (viewModel.forgotPasswordState.value as AuthState.Error).message
        )
    }

    @Test
    fun resetPassword_http400_surfacesFailureCode() = runTest(dispatcher) {
        val repository = FakeAuthRepository().apply {
            resetPasswordFailure = httpException(400, "Invalid reset token")
        }
        val viewModel = AuthViewModel(repository, FakeSessionStore())

        viewModel.resetPassword(
            token = "reset-token-12345678901234567890",
            newPassword = "newpass456",
            confirmPassword = "newpass456"
        )
        advanceUntilIdle()

        assertEquals(
            "Reset failed (400)",
            (viewModel.resetPasswordState.value as AuthState.Error).message
        )
    }

    private fun httpException(code: Int, detail: String): HttpException {
        val body = """{"detail":"$detail"}"""
            .toResponseBody("application/json".toMediaType())
        return HttpException(Response.error<Any>(code, body))
    }
}

private class FakeAuthRepository : AuthRepository {
    var loginFailure: Exception? = null
    var lastGoogleToken: String? = null
    var lastAttemptId: String? = null
    var googleFailure: Exception? = null
    var forgotPasswordFailure: Exception? = null
    var resetPasswordFailure: Exception? = null

    override suspend fun login(email: String, password: String): TokenResponse {
        loginFailure?.let { throw it }
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
        forgotPasswordFailure?.let { throw it }
        return "ok" to null
    }

    override suspend fun resetPassword(token: String, newPassword: String): String {
        resetPasswordFailure?.let { throw it }
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
