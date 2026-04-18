/**
 * Routes requests through the pinned backend origin selected by the endpoint registry.
 */
package com.fitgpt.app.data.network

import android.util.Log
import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Response

class BackendFailoverInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val canRetryAcrossHosts = original.body?.isOneShot() != true
        val candidates = BackendEndpointRegistry.candidateBaseUrls(
            currentUrl = original.url,
            allowFallback = canRetryAcrossHosts
        )

        var lastError: IOException? = null
        for ((index, baseUrl) in candidates.withIndex()) {
            val candidateRequest = original.newBuilder()
                .url(BackendEndpointRegistry.rewrite(original.url, baseUrl))
                .build()

            try {
                val response = chain.proceed(candidateRequest)
                BackendEndpointRegistry.markReachable(baseUrl)
                if (index > 0) {
                    Log.i(LOG_TAG, "Recovered backend connection via $baseUrl")
                }
                return response
            } catch (error: IOException) {
                lastError = error
                Log.w(LOG_TAG, "Backend probe failed for $baseUrl: ${error.javaClass.simpleName}")
            }
        }

        Log.w(LOG_TAG, "NETWORK_DEBUG: Connection failed, check host/IP configuration")
        throw lastError ?: IOException("Unable to reach backend host")
    }

    private companion object {
        const val LOG_TAG = "FitGPTNetwork"
    }
}
