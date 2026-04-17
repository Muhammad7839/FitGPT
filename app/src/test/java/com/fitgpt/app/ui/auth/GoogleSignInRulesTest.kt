package com.fitgpt.app.ui.auth

import android.app.Activity
import com.google.android.gms.common.api.CommonStatusCodes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleSignInRulesTest {

    @Test
    fun shouldShowGoogleSignInButton_returnsFalseWhenClientIdIsBlank() {
        assertFalse(shouldShowGoogleSignInButton(""))
        assertFalse(shouldShowGoogleSignInButton("   "))
    }

    @Test
    fun shouldShowGoogleSignInButton_returnsTrueWhenClientIdIsPresent() {
        assertTrue(shouldShowGoogleSignInButton("client-id.apps.googleusercontent.com"))
    }

    @Test
    fun resolveGoogleSignInOutcome_returnsSuccessWhenResultOkAndAccountAndTokenPresent() {
        val outcome = resolveGoogleSignInOutcome(
            resultCode = Activity.RESULT_OK,
            accountPresent = true,
            email = "user@example.com",
            idToken = "token-123"
        )

        assertTrue(outcome is GoogleSignInOutcome.Success)
        assertEquals("user@example.com", (outcome as GoogleSignInOutcome.Success).email)
    }

    @Test
    fun resolveGoogleSignInOutcome_returnsCancelledWhenResultIsNotOk() {
        val outcome = resolveGoogleSignInOutcome(
            resultCode = Activity.RESULT_CANCELED,
            accountPresent = false,
            email = null,
            idToken = null
        )

        assertTrue(outcome is GoogleSignInOutcome.Failure)
        assertEquals("Google sign-in cancelled", (outcome as GoogleSignInOutcome.Failure).userMessage)
        assertFalse(outcome.shouldClearClientSession)
    }

    @Test
    fun resolveGoogleSignInOutcome_returnsConfigErrorWhenTokenMissing() {
        val outcome = resolveGoogleSignInOutcome(
            resultCode = Activity.RESULT_OK,
            accountPresent = true,
            email = "user@example.com",
            idToken = null
        )

        assertTrue(outcome is GoogleSignInOutcome.Failure)
        val failure = outcome as GoogleSignInOutcome.Failure
        assertEquals("missing_id_token", failure.reason)
        assertEquals(
            "Google Sign-In failed: ID token missing (check client ID / SHA-1 config)",
            failure.userMessage
        )
        assertTrue(failure.shouldClearClientSession)
    }

    @Test
    fun resolveGoogleSignInApiException_returnsConfigErrorForDeveloperError() {
        val outcome = resolveGoogleSignInApiException(CommonStatusCodes.DEVELOPER_ERROR)

        assertEquals("developer_error", outcome.reason)
        assertTrue(outcome.userMessage.contains("configuration error"))
        assertTrue(outcome.shouldClearClientSession)
    }

    @Test
    fun resolveGoogleSignInApiException_doesNotRelabelCancelledAsConfigError() {
        val outcome = resolveGoogleSignInApiException(CommonStatusCodes.CANCELED)

        assertEquals("api_cancelled", outcome.reason)
        assertEquals("Google sign-in cancelled", outcome.userMessage)
        assertFalse(outcome.shouldClearClientSession)
    }
}
