package com.fitgpt.app.ui.auth

import android.app.Activity
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes
import com.google.android.gms.common.api.CommonStatusCodes

internal sealed class GoogleSignInOutcome {
    data class Success(
        val email: String?,
        val idToken: String
    ) : GoogleSignInOutcome()

    data class Failure(
        val userMessage: String,
        val reason: String,
        val email: String?,
        val tokenPresent: Boolean,
        val shouldClearClientSession: Boolean
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
            tokenPresent = !idToken.isNullOrBlank(),
            shouldClearClientSession = false
        )
    }

    if (idToken.isNullOrBlank()) {
        return GoogleSignInOutcome.Failure(
            userMessage = "Google Sign-In failed: ID token missing (check client ID / SHA-1 config)",
            reason = "missing_id_token",
            email = email,
            tokenPresent = false,
            shouldClearClientSession = true
        )
    }

    return GoogleSignInOutcome.Success(
        email = email,
        idToken = idToken
    )
}

internal fun resolveGoogleSignInApiException(statusCode: Int): GoogleSignInOutcome.Failure {
    return when (statusCode) {
        CommonStatusCodes.CANCELED,
        GoogleSignInStatusCodes.SIGN_IN_CANCELLED -> GoogleSignInOutcome.Failure(
            userMessage = "Google sign-in cancelled",
            reason = "api_cancelled",
            email = null,
            tokenPresent = false,
            shouldClearClientSession = false
        )

        CommonStatusCodes.DEVELOPER_ERROR -> GoogleSignInOutcome.Failure(
            userMessage = "Google Sign-In configuration error (status 10). Check client ID and SHA-1 setup.",
            reason = "developer_error",
            email = null,
            tokenPresent = false,
            shouldClearClientSession = true
        )

        else -> GoogleSignInOutcome.Failure(
            userMessage = "Google sign-in failed (status $statusCode)",
            reason = "api_exception_$statusCode",
            email = null,
            tokenPresent = false,
            shouldClearClientSession = true
        )
    }
}
