package com.fitgpt.app.ui.auth

import android.app.Activity
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
    fun resolveGoogleSignInOutcome_returnsCancelledWhenAccountMissing() {
        val outcome = resolveGoogleSignInOutcome(
            resultCode = Activity.RESULT_OK,
            accountPresent = false,
            email = null,
            idToken = null
        )

        assertTrue(outcome is GoogleSignInOutcome.Failure)
        assertEquals("Google sign-in cancelled", (outcome as GoogleSignInOutcome.Failure).userMessage)
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
        assertTrue(failure.userMessage.contains("Google sign-in is misconfigured"))
    }
}
