/**
 * Shared network error mapping for concise, student-friendly messages.
 */
package com.fitgpt.app.viewmodel

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.HttpException

internal fun resolveUploadError(exception: Exception, fallbackMessage: String): String {
    return when (exception) {
        is HttpException -> {
            val rawBody = exception.response()?.errorBody()?.string()?.takeIf { it.isNotBlank() }
            val detail = rawBody?.let(::extractApiDetail)
            when (exception.code()) {
                400, 413, 415 -> detail ?: fallbackMessage
                401 -> "Session expired. Please sign in again."
                403 -> detail ?: "You don't have permission to do that."
                422 -> detail ?: "Some fields are invalid. Check what you filled in."
                else -> detail ?: "$fallbackMessage (server error ${exception.code()})"
            }
        }
        is UnknownHostException -> "No internet connection. Check your network and try again."
        is ConnectException -> "Cannot reach the server. It may still be starting up — try again in a moment."
        is SocketTimeoutException -> "The server took too long to respond. Try again."
        is IOException -> "A network error occurred. Check your connection and retry."
        else -> fallbackMessage
    }
}

/**
 * Resolves auth / validation errors with student-friendly messages.
 * Handles FastAPI detail strings AND detail arrays (Pydantic 422 responses).
 */
internal fun resolveAuthError(exception: Exception): String {
    return when (exception) {
        is HttpException -> {
            val rawBody = exception.response()?.errorBody()?.string()?.takeIf { it.isNotBlank() }
            val detail = rawBody?.let(::extractApiDetail)
            when (exception.code()) {
                401 -> "Incorrect email or password. Please try again."
                403 -> detail ?: "Access denied."
                422 -> detail ?: "Please check your email and password and try again."
                429 -> "Too many attempts. Please wait a minute and try again."
                503 -> "The server is waking up. Try again in a few seconds."
                else -> detail ?: "Something went wrong (error ${exception.code()}). Try again."
            }
        }
        is UnknownHostException -> "No internet connection. Check your network."
        is ConnectException -> "Cannot reach the server. It may be starting up — try again shortly."
        is SocketTimeoutException -> "The server is taking too long. Try again in a moment."
        is IOException -> "A network error occurred. Check your connection."
        else -> "An unexpected error occurred. Please try again."
    }
}

/**
 * Extracts a human-readable message from a FastAPI error body.
 * Handles both string detail and Pydantic array detail formats.
 */
private fun extractApiDetail(rawBody: String): String? {
    return runCatching {
        val json = JSONObject(rawBody)
        when (val detail = json.opt("detail")) {
            is String -> detail.trim().takeIf { it.isNotBlank() }
            is JSONArray -> {
                // Pydantic 422: [{loc: [...], msg: "...", type: "..."}]
                (0 until detail.length())
                    .mapNotNull { i ->
                        detail.optJSONObject(i)?.optString("msg")?.trim()?.takeIf { it.isNotBlank() }
                    }
                    .joinToString(". ")
                    .takeIf { it.isNotBlank() }
                    ?: rawBody.take(200)
            }
            else -> json.optString("message").trim().takeIf { it.isNotBlank() }
        }
    }.getOrNull()
}
