package com.openjarvis.android.core.engine

import com.openjarvis.android.storage.database.entity.DocumentEntity
import kotlinx.coroutines.flow.Flow

enum class ProviderType {
    LOCAL_LLAMA,
    LAN_OLLAMA,
    CLOUD_GEMINI,
    CLOUD_OPENAI,
    CLOUD_ANTHROPIC
}

data class EngineMessage(
    val role: String, // "system", "user", "assistant", "tool"
    val content: String,
    val name: String? = null,
    val toolCallId: String? = null
)

data class ToolCall(
    val id: String,
    val name: String,
    val argumentsJson: String
)

sealed class StreamChunk {
    data class TextDelta(val text: String) : StreamChunk()
    data class ToolCallDelta(val toolCall: ToolCall) : StreamChunk()
    data class ThinkingStep(val thought: String) : StreamChunk()
    data class Completed(val totalTokens: Int, val promptTokens: Int, val completionTokens: Int) : StreamChunk()
    data class Error(val message: String, val throwable: Throwable? = null) : StreamChunk()
}

interface InferenceEngine {
    val providerType: ProviderType
    val modelName: String

    suspend fun isAvailable(): Boolean

    fun generateStream(
        messages: List<EngineMessage>,
        contextMemory: List<DocumentEntity> = emptyList(),
        tools: List<String> = emptyList()
    ): Flow<StreamChunk>
}
