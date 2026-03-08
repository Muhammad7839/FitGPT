package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.UserProfile
import com.fitgpt.app.data.repository.ProfileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Manages profile read/update state for the profile screen.
 */
class ProfileViewModel(
    private val repository: ProfileRepository
) : ViewModel() {

    private val _profileState = MutableStateFlow<UiState<UserProfile>>(UiState.Loading)
    val profileState: StateFlow<UiState<UserProfile>> = _profileState

    init {
        refresh()
    }

    fun refresh() {
        _profileState.value = UiState.Loading
        viewModelScope.launch {
            try {
                _profileState.value = UiState.Success(repository.getProfile())
            } catch (e: Exception) {
                _profileState.value = UiState.Error("Failed to load profile")
            }
        }
    }

    fun updateProfile(
        bodyType: String,
        lifestyle: String,
        comfortPreference: String,
        onboardingComplete: Boolean
    ) {
        _profileState.value = UiState.Loading
        viewModelScope.launch {
            try {
                val updated = repository.updateProfile(
                    bodyType = bodyType,
                    lifestyle = lifestyle,
                    comfortPreference = comfortPreference,
                    onboardingComplete = onboardingComplete
                )
                _profileState.value = UiState.Success(updated)
            } catch (e: Exception) {
                _profileState.value = UiState.Error("Failed to update profile")
            }
        }
    }
}
