package com.openjarvis.android.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.core.events.AgentState
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val sender: String, // "USER" or "JARVIS"
    var content: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Composable
fun ChatScreen() {
    val coreBridge = JarvisApplication.instance.coreBridge
    val agentState by coreBridge.agentState.collectAsState()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var inputPrompt by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            ChatMessage(sender = "JARVIS", content = "Bonjour Monsieur. Systèmes OpenJarvis et moteurs d'inférence connectés. Comment puis-je vous assister ?")
        )
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Message list
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                val isUser = msg.sender == "USER"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                if (isUser) JarvisCyan.copy(alpha = 0.35f)
                                else MaterialTheme.colorScheme.surfaceVariant
                            )
                            .border(
                                1.dp,
                                if (isUser) JarvisCyanLight else JarvisCyan.copy(alpha = 0.2f),
                                RoundedCornerShape(16.dp)
                            )
                            .padding(14.dp)
                    ) {
                        Column {
                            Text(
                                text = if (isUser) "Vous" else "JARVIS",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isUser) JarvisCyanLight else JarvisTextSecondary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = msg.content,
                                fontSize = 14.sp,
                                color = JarvisTextPrimary
                            )
                        }
                    }
                }
            }

            if (agentState == AgentState.THINKING || agentState == AgentState.EXECUTING_TOOL) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = JarvisCyanLight,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (agentState == AgentState.THINKING) "JARVIS raisonne..." else "Exécution de l'outil natif...",
                            color = JarvisTextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Input field
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputPrompt,
                onValueChange = { inputPrompt = it },
                placeholder = { Text("Donnez un ordre à JARVIS...", fontSize = 14.sp) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = JarvisCyanLight,
                    unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                ),
                maxLines = 3
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = {
                    if (inputPrompt.isNotBlank() && agentState == AgentState.IDLE) {
                        val prompt = inputPrompt.trim()
                        messages.add(ChatMessage(sender = "USER", content = prompt))
                        inputPrompt = ""

                        val jarvisMsgIndex = messages.size
                        var streamResponse = ""

                        coreBridge.processQuery(prompt) { delta ->
                            streamResponse += delta
                            if (messages.size > jarvisMsgIndex) {
                                messages[jarvisMsgIndex] = messages[jarvisMsgIndex].copy(content = streamResponse)
                            } else {
                                messages.add(ChatMessage(sender = "JARVIS", content = streamResponse))
                            }
                            scope.launch {
                                listState.animateScrollToItem(messages.size - 1)
                            }
                        }
                    }
                },
                modifier = Modifier
                    .clip(CircleShape)
                    .background(JarvisCyan)
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = JarvisTextPrimary
                )
            }
        }
    }
}
