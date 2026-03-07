/**
 * Adds the persisted bearer token to outbound API requests when available.
 */
package com.fitgpt.app.data.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(
    private val tokenStore: TokenStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        // Interceptors are synchronous; read the current token inline for each request.
        val token = runBlocking { tokenStore.getAccessToken() }
        val original = chain.request()
        if (token.isNullOrBlank()) {
            return chain.proceed(original)
        }

        val authedRequest = original.newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        return chain.proceed(authedRequest)
    }
}
