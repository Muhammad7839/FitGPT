package com.fitgpt.app.ui.auth

internal fun shouldShowGoogleSignInButton(googleClientId: String): Boolean {
    return googleClientId.trim().isNotBlank()
}
