package com.openjarvis.android.memory.model

/**
 * A single conversational turn within a multi-turn session.
 */
data class ConversationTurn(
    val id: String = "turn_${System.currentTimeMillis()}",
    val role: String, // "user" or "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val intent: String? = null,
    val entitiesExtracted: Map<String, String> = emptyMap()
)
