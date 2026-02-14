package com.fitgpt.app.data

import android.content.Context
import androidx.datastore.preferences.preferencesDataStore

val Context.dataStore by preferencesDataStore(
    name = "fitgpt_preferences"
)