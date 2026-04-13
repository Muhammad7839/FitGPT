package com.fitgpt.app.viewmodel

import com.fitgpt.app.data.model.AiChatMessage
import com.fitgpt.app.data.model.AiChatResponse
import com.fitgpt.app.data.repository.ChatRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.runTest
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    @OptIn(ExperimentalCoroutinesApi::class)
    class MainDispatcherRule(
        private val dispatcher: TestDispatcher = UnconfinedTestDispatcher()
    ) : TestWatcher() {
        override fun starting(description: Description) {
            Dispatchers.setMain(dispatcher)
        }

        override fun finished(description: Description) {
            Dispatchers.resetMain()
        }
    }

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun sendMessage_appendsAssistantReply() = runTest {
        val viewModel = ChatViewModel(
            repository = object : ChatRepository {
                override suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse {
                    assertEquals("user", messages.last().role)
                    return AiChatResponse(
                        reply = "Use your black tee and blue jeans.",
                        source = "ai",
                        fallbackUsed = false,
                        warning = null
                    )
                }
            }
        )

        viewModel.sendUserMessage("what should i wear?")
        val state = viewModel.uiState.value

        assertEquals(2, state.messages.size)
        assertEquals("assistant", state.messages.last().role)
        assertTrue(state.error == null)
        assertFalse(state.fallbackUsed)
    }

    @Test
    fun sendMessage_setsErrorOnFailure() = runTest {
        val viewModel = ChatViewModel(
            repository = object : ChatRepository {
                override suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse {
                    error("network down")
                }
            }
        )

        viewModel.sendUserMessage("hello")
        val state = viewModel.uiState.value

        assertEquals(1, state.messages.size)
        assertTrue(state.error != null)
        assertFalse(state.isLoading)
    }

    @Test
    fun retryLastMessage_doesNotDuplicatePendingUserMessage() = runTest {
        var attemptCount = 0
        var retriedPayloadSize = 0
        val viewModel = ChatViewModel(
            repository = object : ChatRepository {
                override suspend fun sendChat(messages: List<AiChatMessage>): AiChatResponse {
                    attemptCount += 1
                    if (attemptCount == 1) {
                        error("temporary failure")
                    }
                    retriedPayloadSize = messages.size
                    return AiChatResponse(
                        reply = "Try the black tee with relaxed trousers.",
                        source = "fallback",
                        fallbackUsed = true,
                        warning = null
                    )
                }
            }
        )

        viewModel.sendUserMessage("I want to go outside")
        assertEquals(1, viewModel.uiState.value.messages.size)

        viewModel.retryLastMessage()
        val state = viewModel.uiState.value

        assertEquals(2, attemptCount)
        assertEquals(1, retriedPayloadSize)
        assertEquals(2, state.messages.size)
        assertEquals("assistant", state.messages.last().role)
        assertTrue(state.error == null)
    }
}
