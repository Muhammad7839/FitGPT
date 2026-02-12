package com.fitgpt.app.ai

import com.fitgpt.app.BuildConfig
import com.fitgpt.app.data.model.ChatMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class GroqChatService {

    private val apiKey: String = BuildConfig.GROQ_API_KEY

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    val isAvailable: Boolean get() = apiKey.isNotBlank()

    companion object {
        private const val API_URL = "https://api.groq.com/openai/v1/chat/completions"
        private const val MODEL = "llama-3.3-70b-versatile"
        private const val TEMPERATURE = 0.7
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }

    suspend fun chat(
        messages: List<ChatMessage>,
        wardrobeContext: String
    ): String = withContext(Dispatchers.IO) {
        val jsonMessages = JSONArray().apply {
            put(JSONObject().apply {
                put("role", "system")
                put("content", buildSystemPrompt(wardrobeContext))
            })
            for (msg in messages) {
                put(JSONObject().apply {
                    put("role", msg.role)
                    put("content", msg.content)
                })
            }
        }

        val body = JSONObject().apply {
            put("model", MODEL)
            put("messages", jsonMessages)
            put("temperature", TEMPERATURE)
        }

        val request = Request.Builder()
            .url(API_URL)
            .addHeader("Authorization", "Bearer $apiKey")
            .addHeader("Content-Type", "application/json")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val response = client.newCall(request).execute()

        if (!response.isSuccessful) {
            throw RuntimeException("Groq API error: ${response.code} ${response.message}")
        }

        val responseBody = response.body?.string()
            ?: throw RuntimeException("Groq API returned empty body")

        JSONObject(responseBody)
            .getJSONArray("choices")
            .getJSONObject(0)
            .getJSONObject("message")
            .getString("content")
    }

    private fun buildSystemPrompt(wardrobeContext: String): String {
        return """
You are a friendly and knowledgeable fashion stylist AI assistant called Style Assistant. You help users with outfit advice, style tips, and wardrobe management.

$wardrobeContext

Guidelines:
- Give practical, personalized advice based on the user's actual wardrobe items and preferences
- Be conversational and encouraging
- When suggesting outfits, reference specific items the user owns
- If asked about items the user doesn't have, suggest what they could add to their wardrobe
- Keep responses concise but helpful
        """.trim()
    }
}
