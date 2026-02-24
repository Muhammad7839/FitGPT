package com.fitgpt.app.data.remote

import android.content.Context
import android.content.SharedPreferences

class TokenManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("fitgpt_auth", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value).apply()
        }

    fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    fun hasToken(): Boolean = token != null

    companion object {
        private const val KEY_TOKEN = "jwt_token"
    }
}
