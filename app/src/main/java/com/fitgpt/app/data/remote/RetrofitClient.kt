package com.fitgpt.app.data.remote

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {

    private const val BASE_URL = "http://10.0.2.2:3001/"

    private var tokenManager: TokenManager? = null
    private var api: FitGptApi? = null

    fun init(tokenManager: TokenManager) {
        this.tokenManager = tokenManager
        this.api = null // reset so it gets recreated with the new token manager
    }

    fun getApi(): FitGptApi {
        return api ?: createApi().also { api = it }
    }

    private fun createApi(): FitGptApi {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val token = tokenManager?.token
            val request = if (token != null) {
                original.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            } else {
                original
            }
            chain.proceed(request)
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(FitGptApi::class.java)
    }
}
