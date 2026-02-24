package com.fitgpt.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.fitgpt.app.data.remote.RetrofitClient
import com.fitgpt.app.data.remote.TokenManager
import com.fitgpt.app.data.repository.ApiWardrobeRepository
import com.fitgpt.app.navigation.AppNavHost
import com.fitgpt.app.ui.theme.FitGPTTheme
import com.fitgpt.app.viewmodel.AuthViewModel
import com.fitgpt.app.viewmodel.AuthViewModelFactory
import com.fitgpt.app.viewmodel.WardrobeViewModel
import com.fitgpt.app.viewmodel.WardrobeViewModelFactory

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val tokenManager = TokenManager(this)
        RetrofitClient.init(tokenManager)

        val api = RetrofitClient.getApi()
        val repository = ApiWardrobeRepository(api)

        val wardrobeViewModel: WardrobeViewModel by viewModels {
            WardrobeViewModelFactory(repository)
        }
        val authViewModel: AuthViewModel by viewModels {
            AuthViewModelFactory(api, tokenManager)
        }

        setContent {
            FitGPTTheme {
                AppNavHost(
                    wardrobeViewModel = wardrobeViewModel,
                    authViewModel = authViewModel,
                    hasToken = tokenManager.hasToken()
                )
            }
        }
    }
}
