/**
 * Emits focused request/response diagnostics for wardrobe API calls without logging secrets.
 */
package com.fitgpt.app.data.network

import android.util.Log
import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Response

class WardrobeDebugInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (!request.url.encodedPath.contains("/wardrobe")) {
            return chain.proceed(request)
        }

        Log.d(LOG_TAG, "Request URL: ${request.url}")
        Log.d(LOG_TAG, "Auth header present: ${request.header("Authorization") != null}")

        return try {
            val response = chain.proceed(request)
            Log.d(LOG_TAG, "Response code: ${response.code}")
            if (!response.isSuccessful) {
                Log.d(LOG_TAG, "Error response: ${response.peekBody(4096).string()}")
            }
            response
        } catch (exception: IOException) {
            Log.d(LOG_TAG, "Connection failed, check host/IP configuration")
            throw exception
        }
    }

    private companion object {
        const val LOG_TAG = "WARDROBE_DEBUG"
    }
}
