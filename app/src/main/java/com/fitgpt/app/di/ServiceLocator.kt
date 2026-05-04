/**
 * Manual DI container wiring Retrofit clients and repository instances.
 */
package com.fitgpt.app.di

import android.content.Context
import android.util.Log
import com.fitgpt.app.BuildConfig
import com.fitgpt.app.data.auth.AuthInterceptor
import com.fitgpt.app.data.network.BackendEnvironmentResolver
import com.fitgpt.app.data.network.BackendEndpointRegistry
import com.fitgpt.app.data.network.BackendFailoverInterceptor
import com.fitgpt.app.data.network.WardrobeDebugInterceptor
import com.fitgpt.app.data.auth.TokenStore
import com.fitgpt.app.data.remote.ApiService
import com.fitgpt.app.data.repository.AuthRepository
import com.fitgpt.app.data.repository.ChatRepository
import com.fitgpt.app.data.repository.FileWardrobeImageStore
import com.fitgpt.app.data.repository.ProfileRepository
import com.fitgpt.app.data.repository.RemoteAuthRepository
import com.fitgpt.app.data.repository.RemoteChatRepository
import com.fitgpt.app.data.repository.RemoteProfileRepository
import com.fitgpt.app.data.repository.RemoteWardrobeRepository
import com.fitgpt.app.data.repository.WardrobeRepository
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ServiceLocator {
    private const val NETWORK_LOG_TAG = "FitGPTNetwork"

    @Volatile
    private var tokenStore: TokenStore? = null

    @Volatile
    private var apiService: ApiService? = null

    @Volatile
    private var authRepository: AuthRepository? = null

    @Volatile
    private var wardrobeRepository: WardrobeRepository? = null

    @Volatile
    private var profileRepository: ProfileRepository? = null

    @Volatile
    private var chatRepository: ChatRepository? = null

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
                imageStore = FileWardrobeImageStore(context.applicationContext),
            ).also { wardrobeRepository = it }
        }
    }

    fun provideProfileRepository(context: Context): ProfileRepository {
        return profileRepository ?: synchronized(this) {
            profileRepository ?: RemoteProfileRepository(
                api = provideApiService(context)
            ).also { profileRepository = it }
        }
    }

    fun provideChatRepository(context: Context): ChatRepository {
        return chatRepository ?: synchronized(this) {
            chatRepository ?: RemoteChatRepository(
                api = provideApiService(context)
            ).also { chatRepository = it }
        }
    }

    private fun provideApiService(context: Context): ApiService {
        return apiService ?: synchronized(this) {
            val baseUrl = resolveActiveBaseUrl()
            BackendEndpointRegistry.initialize(baseUrl)
            apiService ?: Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(buildHttpClient(context))
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
                .also { apiService = it }
        }
    }

    fun logActiveBaseUrl() {
        val baseUrl = resolveActiveBaseUrl()
        Log.i(NETWORK_LOG_TAG, "NETWORK_DEBUG: baseUrl=$baseUrl")
    }

    private fun resolveActiveBaseUrl(): String {
        return BackendEnvironmentResolver.resolveBaseUrl(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            physicalLanBaseUrl = BuildConfig.API_LAN_BASE_URL
        )
    }

    private fun buildHttpClient(context: Context): OkHttpClient {
        val logger = HttpLoggingInterceptor().apply {
            redactHeader("Authorization")
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        return OkHttpClient.Builder()
            .addInterceptor(BackendFailoverInterceptor())
            .addInterceptor(AuthInterceptor(provideTokenStore(context)))
            .addInterceptor(WardrobeDebugInterceptor())
            .addInterceptor(logger)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
