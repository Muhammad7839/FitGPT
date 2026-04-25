/**
 * Shared network error mapping for concise user-facing messages.
 */
package com.fitgpt.app.viewmodel

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import org.json.JSONObject
import retrofit2.HttpException

internal fun resolveUploadError(exception: Exception, fallbackMessage: String): String {
    return when (exception) {
        is HttpException -> {
            val detail = exception.response()?.errorBody()?.string()
                ?.takeIf { it.isNotBlank() }
                ?.let(::extractApiDetail)
            when (exception.code()) {
                400, 413, 415 -> detail ?: fallbackMessage
                401 -> "Please sign in again and retry the upload"
                403 -> detail ?: "You are not allowed to upload this file"
                else -> detail ?: "$fallbackMessage (${exception.code()})"
            }
        }
        is UnknownHostException -> "No internet or host not found during upload"
        is ConnectException -> "Cannot reach backend during upload (check server is running)"
        is SocketTimeoutException -> "Backend timeout during upload"
        is IOException -> "Network I/O error during upload"
        else -> fallbackMessage
    }
}

private fun extractApiDetail(rawBody: String): String {
    return runCatching {
        JSONObject(rawBody).optString("detail").takeIf { it.isNotBlank() } ?: rawBody
    }.getOrDefault(rawBody).trim()
}
