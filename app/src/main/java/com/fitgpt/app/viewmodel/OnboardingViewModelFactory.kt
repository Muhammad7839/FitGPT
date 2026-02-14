package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.fitgpt.app.data.PreferencesManager

class OnboardingViewModelFactory(
    private val prefs: PreferencesManager
) : ViewModelProvider.Factory {

    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(OnboardingViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return OnboardingViewModel(prefs) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}