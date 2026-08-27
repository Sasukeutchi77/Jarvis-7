package com.openjarvis.android.core.events

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed class JarvisEvent {
    data class UserSpeechRecognized(val text: String, val isFinal: Boolean) : JarvisEvent()
    data class AgentStateChanged(val state: AgentState) : JarvisEvent()
    data class ContentStreamChunk(val text: String) : JarvisEvent()
    data class ToolExecutionEvent(val toolName: String, val status: String, val resultSummary: String? = null) : JarvisEvent()
    data class TtsPlaybackState(val isSpeaking: Boolean, val text: String = "") : JarvisEvent()
    data class SystemAlert(val message: String, val level: String = "INFO") : JarvisEvent()
}

enum class AgentState {
    IDLE,
    LISTENING,
    THINKING,
    EXECUTING_TOOL,
    SPEAKING,
    ERROR
}

object JarvisEventBus {
    private val _events = MutableSharedFlow<JarvisEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<JarvisEvent> = _events.asSharedFlow()

    fun emit(event: JarvisEvent) {
        _events.tryEmit(event)
    }

    suspend fun emitSuspend(event: JarvisEvent) {
        _events.emit(event)
    }
}
