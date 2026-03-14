/**
 * Chat UI for backend-proxied AI stylist conversation.
 */
package com.fitgpt.app.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.fitgpt.app.navigation.Routes
import com.fitgpt.app.ui.common.FitGptScaffold
import com.fitgpt.app.ui.common.SectionHeader
import com.fitgpt.app.ui.common.WebBadge
import com.fitgpt.app.ui.common.WebCard
import com.fitgpt.app.viewmodel.ChatUiMessage
import com.fitgpt.app.viewmodel.ChatViewModel

@Composable
fun ChatScreen(
    navController: NavController,
    viewModel: ChatViewModel
) {
    val state by viewModel.uiState.collectAsState()
    var input by rememberSaveable { mutableStateOf("") }

    FitGptScaffold(
        navController = navController,
        currentRoute = Routes.CHAT,
        title = "AI Chat",
        showMoreAction = false
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionHeader(
                title = "Stylist Chat",
                subtitle = "Ask for quick outfit help by weather, occasion, or item."
            )

            state.source?.let { source ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    WebBadge(text = if (source == "ai") "AI-powered" else "Fallback")
                    state.warning?.let { warning ->
                        if (state.fallbackUsed) {
                            WebBadge(text = warning)
                        }
                    }
                }
            }

            WebCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = true)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 220.dp)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    itemsIndexed(state.messages) { _, message ->
                        ChatBubble(message = message)
                    }
                    if (state.isLoading) {
                        item {
                            Text(
                                text = "AI is typing...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            state.error?.let { error ->
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                label = { Text("Type your message") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = false,
                minLines = 2,
                maxLines = 4
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = {
                        viewModel.sendUserMessage(input)
                        input = ""
                    },
                    enabled = input.trim().isNotEmpty() && !state.isLoading,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Send")
                }
                Button(
                    onClick = { viewModel.retryLastMessage() },
                    enabled = !state.isLoading && state.pendingInput != null
                ) {
                    Text("Retry")
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(message: ChatUiMessage) {
    val title = if (message.role == "user") "You" else "FitGPT"
    val tone = if (message.role == "user") {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.secondary
    }
    WebCard(
        modifier = Modifier.fillMaxWidth(),
        accentTop = false
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = tone
            )
            Text(
                text = message.content,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
