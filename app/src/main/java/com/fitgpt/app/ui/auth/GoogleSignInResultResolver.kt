package com.fitgpt.app.ui.auth

import android.app.Activity

internal sealed class GoogleSignInOutcome {
    data class Success(
        val email: String?,
        val idToken: String
    ) : GoogleSignInOutcome()

    data class Failure(
        val userMessage: String,
        val reason: String,
        val email: String?,
        val tokenPresent: Boolean
    ) : GoogleSignInOutcome()
}

internal fun resolveGoogleSignInOutcome(
    resultCode: Int,
    accountPresent: Boolean,
    email: String?,
    idToken: String?
): GoogleSignInOutcome {
    if (resultCode != Activity.RESULT_OK || !accountPresent) {
        return GoogleSignInOutcome.Failure(
            userMessage = "Google sign-in cancelled",
            reason = "cancelled_or_missing_account",
            email = email,
            tokenPresent = !idToken.isNullOrBlank()
        )
    }

    if (idToken.isNullOrBlank()) {
        return GoogleSignInOutcome.Failure(
            userMessage = "Google sign-in is misconfigured. Check GOOGLE_CLIENT_ID, Firebase SHA-1, and OAuth setup.",
            reason = "missing_id_token",
            email = email,
            tokenPresent = false
        )
    }

    return GoogleSignInOutcome.Success(
        email = email,
        idToken = idToken
    )
}
