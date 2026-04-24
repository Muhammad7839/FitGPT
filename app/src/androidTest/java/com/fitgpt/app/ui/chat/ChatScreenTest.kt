package com.fitgpt.app.ui.chat

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.navigation.compose.rememberNavController
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse
import com.fitgpt.app.data.repository.ChatRepository
import com.fitgpt.app.viewmodel.ChatViewModel
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ChatScreenTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun emptyStateCopyDisappearsAfterFirstMessage() {
        val viewModel = ChatViewModel(
            repository = object : ChatRepository {
                override suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse {
                    return AiChatResponse(
                        reply = "Try a clean tee with relaxed bottoms.",
                        source = "fallback",
                        fallbackUsed = true,
                        warning = null
                    )
                }
            }
        )

        composeRule.setContent {
            ChatScreen(
                navController = rememberNavController(),
                viewModel = viewModel
            )
        }

        assertTextExists("Start a conversation")
        assertTextMissing("Ask AURA")
        assertTextMissing("AURA keeps the context from this live session, so you can keep refining the same conversation.")

        composeRule.onNodeWithText("Ask about an outfit").performTextInput("Build me something casual")
        composeRule.onNodeWithText("Send").performClick()

        composeRule.waitUntil(timeoutMillis = 3_000) {
            composeRule.onAllNodesWithText("Try a clean tee with relaxed bottoms.").fetchSemanticsNodes().isNotEmpty()
        }

        assertTextMissing("Start a conversation")
        assertTextExists("Try a clean tee with relaxed bottoms.")
    }

    private fun assertTextExists(text: String) {
        assertTrue(
            "Expected node with text '$text' to exist",
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        )
    }

    private fun assertTextMissing(text: String) {
        assertFalse(
            "Expected node with text '$text' to be absent",
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        )
    }
}
