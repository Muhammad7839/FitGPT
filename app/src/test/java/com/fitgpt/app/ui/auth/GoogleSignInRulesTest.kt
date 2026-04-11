package com.fitgpt.app.ui.auth

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
}
