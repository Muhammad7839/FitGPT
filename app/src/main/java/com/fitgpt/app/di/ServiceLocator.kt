/**
 * Minimal service locator wiring API clients and repository instances.
 */
package com.fitgpt.app.di

import android.content.Context
import com.fitgpt.app.data.auth.AuthInterceptor
import com.fitgpt.app.data.auth.TokenStore
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.repository.AuthRepository
import com.fitgpt.app.data.repository.RemoteAuthRepository
import com.fitgpt.app.data.repository.RemoteWardrobeRepository
import com.fitgpt.app.data.repository.WardrobeRepository
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ServiceLocator {
    private const val BASE_URL = "http://10.0.2.2:8000/"

    @Volatile
    private var tokenStore: TokenStore? = null

    @Volatile
    private var apiService: ApiService? = null

    @Volatile
    private var authRepository: AuthRepository? = null

    @Volatile
    private var wardrobeRepository: WardrobeRepository? = null

    fun provideTokenStore(context: Context): TokenStore {
        return tokenStore ?: synchronized(this) {
            tokenStore ?: TokenStore(context).also { tokenStore = it }
        }
    }

    fun provideAuthRepository(context: Context): AuthRepository {
        return authRepository ?: synchronized(this) {
            authRepository ?: RemoteAuthRepository(
                api = provideApiService(context)
            ).also { authRepository = it }
        }
    }

    fun provideWardrobeRepository(context: Context): WardrobeRepository {
        return wardrobeRepository ?: synchronized(this) {
            wardrobeRepository ?: RemoteWardrobeRepository(
                api = provideApiService(context),
            ).also { wardrobeRepository = it }
        }
    }

    private fun provideApiService(context: Context): ApiService {
        return apiService ?: synchronized(this) {
            apiService ?: Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(buildHttpClient(context))
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
                .also { apiService = it }
        }
    }

    private fun buildHttpClient(context: Context): OkHttpClient {
        val logger = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(provideTokenStore(context)))
            .addInterceptor(logger)
            .build()
    }
}
