/**
 * Exposes onboarding completion state and persists onboarding completion events.
 */
package com.fitgpt.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fitgpt.app.data.model.OnboardingAnswers
import com.fitgpt.app.data.PreferencesManager
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class OnboardingViewModel(
    private val prefs: PreferencesManager
) : ViewModel() {

    val completed =
        prefs.onboardingCompleted.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = false
        )
    val answers =
        prefs.onboardingAnswers.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = OnboardingAnswers()
        )

    fun markCompleted() {
        viewModelScope.launch {
            prefs.setOnboardingCompleted()
        }
    }

    fun saveAnswers(answers: OnboardingAnswers) {
        viewModelScope.launch {
            prefs.setOnboardingAnswers(answers)
        }
    }

    fun completeOnboarding(answers: OnboardingAnswers) {
        viewModelScope.launch {
            prefs.setOnboardingAnswers(answers)
            prefs.setOnboardingCompleted()
        }
    }
}
