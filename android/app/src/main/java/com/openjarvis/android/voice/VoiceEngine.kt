package com.openjarvis.android.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.core.bridge.OpenJarvisCoreBridge
import com.openjarvis.android.core.events.AgentState
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.voice.speech.AndroidSpeechProvider
import com.openjarvis.android.voice.speech.DeepgramSpeechProvider
import com.openjarvis.android.voice.speech.SpeechProvider
import com.openjarvis.android.voice.tts.AndroidTtsEngine
import com.openjarvis.android.voice.tts.DeepgramTtsEngine
import com.openjarvis.android.voice.tts.TtsEngine
import com.openjarvis.android.voice.wakeword.WakeWordEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Main Voice Assistant Orchestrator for JARVIS.
 * Coordinates Wake-word Detection, Speech-to-Text Recognition, Text-to-Speech Vocalization,
 * AudioFocus, and Interruption Handling.
 */
class VoiceEngine(
    private val context: Context,
    private val configManager: ConfigManager,
    private val secureVault: SecureVault,
    private val coreBridge: OpenJarvisCoreBridge
) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    private val _voiceState = MutableStateFlow(VoiceState.IDLE)
    val voiceState: StateFlow<VoiceState> = _voiceState.asStateFlow()

    private val _currentTranscript = MutableStateFlow("")
    val currentTranscript: StateFlow<String> = _currentTranscript.asStateFlow()

    private val _audioLevel = MutableStateFlow(0f)
    val audioLevel: StateFlow<Float> = _audioLevel.asStateFlow()

    // Subcomponents
    val wakeWordEngine = WakeWordEngine(context)
    val speechProvider: SpeechProvider = DeepgramSpeechProvider(context, secureVault)
    val ttsEngine: TtsEngine = AndroidTtsEngine(context)

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null

    private var commandTimeoutJob: Job? = null

    fun initialize() {
        val config = configManager.config.value
        wakeWordEngine.setWakeWord(config.wakeWordPhrase)
        wakeWordEngine.setSensitivity(config.wakeWordSensitivity)
        wakeWordEngine.setCooldownMs((config.wakeWordCooldownSec * 1000).toLong())

        // Wake word callback
        wakeWordEngine.onWakeWordDetected { phrase ->
            onWakeWordTriggered(phrase)
        }

        wakeWordEngine.onRmsChanged { rmsDb ->
            if (_voiceState.value == VoiceState.LISTENING_FOR_WAKE_WORD) {
                _audioLevel.value = rmsDb
            }
        }

        JarvisLogger.i("VoiceEngine", "VoiceEngine initialized with wake-word: '${config.wakeWordPhrase}', threshold: ${String.format("%.2f", wakeWordEngine.getThreshold())}")
    }

    /**
     * Start continuous background voice listening.
     */
    fun startBackgroundListening() {
        val config = configManager.config.value
        if (!config.wakeWordEnabled) {
            JarvisLogger.i("VoiceEngine", "Wake word disabled in config, not starting background listening.")
            return
        }

        if (_voiceState.value == VoiceState.IDLE || _voiceState.value == VoiceState.STOPPED) {
            updateState(VoiceState.LISTENING_FOR_WAKE_WORD)
            wakeWordEngine.setWakeWord(config.wakeWordPhrase)
            wakeWordEngine.setSensitivity(config.wakeWordSensitivity)
            wakeWordEngine.setCooldownMs((config.wakeWordCooldownSec * 1000).toLong())
            wakeWordEngine.start()
            JarvisLogger.i("VoiceEngine", "Background voice listening started for '${config.wakeWordPhrase}'")
        }
    }

    /**
     * Stop all voice listening and speak output.
     */
    fun stopBackgroundListening() {
        wakeWordEngine.stop()
        speechProvider.stopListening()
        ttsEngine.stop()
        abandonAudioFocus()
        updateState(VoiceState.STOPPED)
        JarvisLogger.i("VoiceEngine", "Background voice listening stopped.")
    }

    /**
     * Triggered when "Hey JARVIS" is detected.
     */
    private fun onWakeWordTriggered(phrase: String) {
        JarvisLogger.i("VoiceEngine", "Wake word triggered: '$phrase'")
        updateState(VoiceState.WAKE_WORD_DETECTED)

        requestAudioFocus()

        // Give immediate audio/speech acknowledgment
        ttsEngine.speak(
            text = "Oui ?",
            onStart = {
                wakeWordEngine.pause()
            },
            onDone = {
                startListeningForCommand()
            },
            onError = {
                startListeningForCommand()
            }
        )
    }

    /**
     * Transition to LISTENING_COMMAND and start SpeechRecognizer.
     */
    fun startListeningForCommand() {
        wakeWordEngine.pause()
        updateState(VoiceState.LISTENING_COMMAND)
        _currentTranscript.value = ""

        requestAudioFocus()

        val timeoutSec = configManager.config.value.commandTimeoutSec
        startCommandTimeout(timeoutSec)

        speechProvider.startListening(
            language = "fr-FR",
            onPartialResult = { partial ->
                _currentTranscript.value = partial
                resetCommandTimeout(timeoutSec)

                // Barge-in check during listening
                if (isInterruptionPhrase(partial)) {
                    cancelCurrentInteraction("Interruption vocale demandée.")
                }
            },
            onFinalResult = { finalTranscript ->
                cancelCommandTimeout()
                if (finalTranscript.isNotBlank()) {
                    if (isInterruptionPhrase(finalTranscript)) {
                        cancelCurrentInteraction("Interruption vocale demandée.")
                    } else {
                        processUserVoiceCommand(finalTranscript)
                    }
                } else {
                    returnToWakeWordListening()
                }
            },
            onError = { _, errorMsg ->
                JarvisLogger.w("VoiceEngine", "Command recognition error: $errorMsg")
                cancelCommandTimeout()
                returnToWakeWordListening()
            },
            onRmsDbChanged = { rmsDb ->
                _audioLevel.value = rmsDb
            }
        )
    }

    /**
     * Send recognized voice prompt to OpenJarvisCoreBridge for real reasoning & execution.
     */
    private fun processUserVoiceCommand(prompt: String) {
        updateState(VoiceState.PROCESSING)
        _currentTranscript.value = prompt
        JarvisLogger.i("VoiceEngine", "Processing voice command: '$prompt'")

        scope.launch {
            coreBridge.processQuery(prompt) { delta ->
                // Streaming feedback
            }

            // Vocalize response
            val response = coreBridge.lastResponse.value
            if (response.isNotBlank()) {
                updateState(VoiceState.SPEAKING)
                ttsEngine.speak(
                    text = response,
                    onStart = {
                        wakeWordEngine.pause()
                    },
                    onDone = {
                        returnToWakeWordListening()
                    },
                    onError = {
                        returnToWakeWordListening()
                    }
                )
            } else {
                returnToWakeWordListening()
            }
        }
    }

    /**
     * Check if speech contains an interruption phrase ("arrête", "stop", "tais-toi", "jarvis arrête").
     */
    fun isInterruptionPhrase(text: String): Boolean {
        val lower = text.trim().lowercase()
        return lower == "arrête" || lower == "arrete" ||
               lower == "stop" || lower == "tais-toi" || lower == "tais toi" ||
               lower == "jarvis arrête" || lower == "jarvis arrete" || lower == "jarvis stop" ||
               lower == "annule" || lower == "pause"
    }

    /**
     * Cancel any active interaction immediately.
     */
    fun cancelCurrentInteraction(reason: String = "Annulé") {
        JarvisLogger.i("VoiceEngine", "Cancelling interaction: $reason")
        cancelCommandTimeout()
        speechProvider.stopListening()
        ttsEngine.stop()
        ttsEngine.speak("À vos ordres.") {
            returnToWakeWordListening()
        }
    }

    /**
     * Return to listening for wake word or idle.
     * Uses a 350ms acoustic stabilization delay to prevent speaker echo feedback.
     */
    fun returnToWakeWordListening() {
        abandonAudioFocus()
        val config = configManager.config.value
        if (config.wakeWordEnabled && config.backgroundListening) {
            updateState(VoiceState.LISTENING_FOR_WAKE_WORD)
            scope.launch {
                delay(350L) // Acoustic stabilization guard
                wakeWordEngine.resume()
            }
        } else {
            updateState(VoiceState.IDLE)
        }
    }

    private fun startCommandTimeout(timeoutSec: Int) {
        cancelCommandTimeout()
        commandTimeoutJob = scope.launch {
            delay(timeoutSec * 1000L)
            JarvisLogger.d("VoiceEngine", "Voice command listening timed out after $timeoutSec s.")
            speechProvider.stopListening()
            returnToWakeWordListening()
        }
    }

    private fun resetCommandTimeout(timeoutSec: Int) {
        startCommandTimeout(timeoutSec)
    }

    private fun cancelCommandTimeout() {
        commandTimeoutJob?.cancel()
        commandTimeoutJob = null
    }

    private fun updateState(newState: VoiceState) {
        _voiceState.value = newState
        JarvisEventBus.emit(JarvisEvent.AgentStateChanged(
            when (newState) {
                VoiceState.IDLE, VoiceState.STOPPED -> AgentState.IDLE
                VoiceState.LISTENING_FOR_WAKE_WORD, VoiceState.LISTENING_COMMAND, VoiceState.WAKE_WORD_DETECTED -> AgentState.LISTENING
                VoiceState.PROCESSING -> AgentState.THINKING
                VoiceState.SPEAKING -> AgentState.SPEAKING
                VoiceState.ERROR -> AgentState.ERROR
                VoiceState.PAUSED -> AgentState.IDLE
            }
        ))
        JarvisLogger.d("VoiceEngine", "Voice state -> $newState")
    }

    private fun requestAudioFocus() {
        if (audioManager == null) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val playbackAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(playbackAttributes)
                    .setOnAudioFocusChangeListener { focusChange ->
                        JarvisLogger.d("VoiceEngine", "AudioFocus changed: $focusChange")
                    }
                    .build()
                audioManager.requestAudioFocus(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
        } catch (e: Exception) {
            JarvisLogger.e("VoiceEngine", "Error requesting AudioFocus", e)
        }
    }

    private fun abandonAudioFocus() {
        if (audioManager == null) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (e: Exception) {
            JarvisLogger.e("VoiceEngine", "Error abandoning AudioFocus", e)
        }
    }
}
