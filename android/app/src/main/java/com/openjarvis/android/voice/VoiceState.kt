package com.openjarvis.android.voice

/**
 * State Machine for JARVIS Voice Assistant Architecture.
 * Complies with strict Étape 1 state lifecycle:
 * IDLE -> LISTENING_FOR_WAKE_WORD -> WAKE_WORD_DETECTED -> LISTENING_COMMAND -> PROCESSING -> SPEAKING -> PAUSED / ERROR / STOPPED
 */
enum class VoiceState {
    IDLE,
    LISTENING_FOR_WAKE_WORD,
    WAKE_WORD_DETECTED,
    LISTENING_COMMAND,
    PROCESSING,
    SPEAKING,
    PAUSED,
    ERROR,
    STOPPED;

    val isListening: Boolean
        get() = this == LISTENING_FOR_WAKE_WORD || this == LISTENING_COMMAND

    val isBusy: Boolean
        get() = this == PROCESSING || this == SPEAKING || this == WAKE_WORD_DETECTED
}
