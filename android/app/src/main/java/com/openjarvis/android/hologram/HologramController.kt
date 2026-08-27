package com.openjarvis.android.hologram

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.voice.VoiceEngine
import com.openjarvis.android.voice.VoiceState
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
 * Central State Coordinator and Lifecycle Manager for the JARVIS Holographic HUD.
 * Coordinates VoiceEngine, WindowManager Overlay, Real-time Audio Visualizer,
 * Haptic Pulse, and Auto-Dismiss timers.
 * Enforces strict single-instance guarantees (no duplicate overlays).
 */
class HologramController(
    private val context: Context,
    private val configManager: ConfigManager
) {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val _hologramState = MutableStateFlow(HologramState.HIDDEN)
    val hologramState: StateFlow<HologramState> = _hologramState.asStateFlow()

    private val _hologramConfig = MutableStateFlow(HologramConfig())
    val hologramConfig: StateFlow<HologramConfig> = _hologramConfig.asStateFlow()
    val config: HologramConfig get() = _hologramConfig.value

    val visualizer = VoiceVisualizer()
    val ttsAudioAnalyzer = TtsAudioAnalyzer(visualizer)

    private var overlayService: HologramOverlayService? = null
    private var autoDismissJob: Job? = null
    private var voiceStateObserverJob: Job? = null

    // Hardware Feedback
    private var vibrator: Vibrator? = null
    private var toneGenerator: ToneGenerator? = null

    init {
        instance = this
        initHardwareFeedback()
    }

    private fun initHardwareFeedback() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 60)
        } catch (e: Exception) {
            JarvisLogger.w("HologramController", "Failed to initialize hardware vibrator/tone generator: ${e.message}")
        }
    }

    /**
     * Start observing VoiceEngine state changes and audio levels.
     */
    fun bindToVoiceEngine(voiceEngine: VoiceEngine) {
        voiceStateObserverJob?.cancel()

        // 1. Observe VoiceState transitions
        voiceStateObserverJob = scope.launch {
            voiceEngine.voiceState.collect { voiceState ->
                onVoiceStateChanged(voiceState, voiceEngine)
            }
        }

        // 2. Observe Microphone Audio RMS Levels
        scope.launch {
            voiceEngine.audioLevel.collect { rmsDb ->
                if (_hologramState.value == HologramState.LISTENING || _hologramState.value == HologramState.APPEARING) {
                    visualizer.processMicrophoneLevel(rmsDb)
                }
            }
        }

        // 3. Observe Live Transcript
        scope.launch {
            voiceEngine.currentTranscript.collect { transcript ->
                if (_hologramState.value.isVisible) {
                    updateOverlayDisplay(
                        state = _hologramState.value,
                        statusText = getStatusLabelForState(_hologramState.value),
                        transcript = transcript
                    )
                }
            }
        }
    }

    fun updateConfig(newConfig: HologramConfig) {
        _hologramConfig.value = newConfig
        overlayService?.updateHologramState(
            state = _hologramState.value,
            statusText = getStatusLabelForState(_hologramState.value),
            theme = newConfig.themeColor,
            quality = newConfig.quality
        )
    }

    fun attachOverlayService(service: HologramOverlayService) {
        this.overlayService = service
        JarvisLogger.i("HologramController", "HologramOverlayService attached.")
        // Sync current state immediately
        if (_hologramState.value.isVisible) {
            service.showOverlay()
            service.updateHologramState(
                state = _hologramState.value,
                statusText = getStatusLabelForState(_hologramState.value),
                theme = config.themeColor,
                quality = config.quality
            )
        }
    }

    fun detachOverlayService() {
        this.overlayService = null
        JarvisLogger.i("HologramController", "HologramOverlayService detached.")
    }

    /**
     * Handles VoiceEngine state changes and synchronizes the Holographic HUD.
     */
    private fun onVoiceStateChanged(voiceState: VoiceState, voiceEngine: VoiceEngine) {
        cancelAutoDismissTimer()

        when (voiceState) {
            VoiceState.WAKE_WORD_DETECTED -> {
                onWakeWordDetected()
            }
            VoiceState.LISTENING_COMMAND -> {
                onListeningStarted()
            }
            VoiceState.PROCESSING -> {
                onProcessingStarted()
            }
            VoiceState.SPEAKING -> {
                val lastResponse = JarvisApplication.instance.coreBridge.lastResponse.value
                onSpeakingStarted(lastResponse)
            }
            VoiceState.IDLE -> {
                onConversationIdle()
            }
            VoiceState.LISTENING_FOR_WAKE_WORD -> {
                if (_hologramState.value != HologramState.HIDDEN && _hologramState.value != HologramState.DISMISSING) {
                    onConversationIdle()
                }
            }
            VoiceState.STOPPED, VoiceState.ERROR -> {
                dismissHologram()
            }
            VoiceState.PAUSED -> {
                // Keep current state or dim
            }
        }
    }

    /**
     * Triggered when « Hey JARVIS » is recognized.
     */
    fun onWakeWordDetected() {
        JarvisLogger.i("HologramController", "Wake-word triggered -> Activating Hologram HUD")
        cancelAutoDismissTimer()

        // 1. Play subtle haptic feedback
        playHapticFeedback()

        // 2. Play futuristic activation chime
        playActivationChime()

        // 3. Set state to APPEARING
        transitionToState(HologramState.APPEARING)

        // 4. Mount overlay window if permission is granted and overlay is enabled
        ensureOverlayWindow()

        updateOverlayDisplay(
            state = HologramState.APPEARING,
            statusText = "J.A.R.V.I.S. EN LIGNE"
        )
    }

    /**
     * Triggered when microphone begins capturing the user's speech command.
     */
    fun onListeningStarted() {
        transitionToState(HologramState.LISTENING)
        updateOverlayDisplay(
            state = HologramState.LISTENING,
            statusText = "ÉCOUTE DE LA COMMANDE..."
        )
    }

    /**
     * Triggered when JARVIS starts neural reasoning and tool execution.
     */
    fun onProcessingStarted() {
        transitionToState(HologramState.THINKING)
        updateOverlayDisplay(
            state = HologramState.THINKING,
            statusText = "RAISONNEMENT JARVIS..."
        )
    }

    /**
     * Triggered when TTS begins speaking the answer.
     */
    fun onSpeakingStarted(spokenText: String) {
        transitionToState(HologramState.SPEAKING)
        ttsAudioAnalyzer.startSpeechTracking(spokenText)
        updateOverlayDisplay(
            state = HologramState.SPEAKING,
            statusText = "J.A.R.V.I.S.",
            transcript = spokenText
        )
    }

    /**
     * Triggered when dialogue turn completes and assistant returns to standby.
     */
    fun onConversationIdle() {
        ttsAudioAnalyzer.stopSpeechTracking()
        transitionToState(HologramState.IDLE)
        updateOverlayDisplay(
            state = HologramState.IDLE,
            statusText = "EN ATTENTE..."
        )

        // Auto-dismiss countdown
        if (config.autoHide) {
            scheduleAutoDismiss(config.autoHideDelaySec)
        }
    }

    /**
     * User tapped directly on the Hologram HUD.
     */
    fun onHologramTapped() {
        val voiceEngine = JarvisApplication.instance.voiceEngine
        when (_hologramState.value) {
            HologramState.IDLE -> {
                voiceEngine.startListeningForCommand()
            }
            HologramState.LISTENING -> {
                voiceEngine.speechProvider.stopListening()
            }
            HologramState.SPEAKING, HologramState.THINKING -> {
                voiceEngine.cancelCurrentInteraction("Interruption tactile")
            }
            else -> {
                dismissHologram()
            }
        }
    }

    /**
     * Dismisses the Hologram with exit animation.
     */
    fun dismissHologram() {
        cancelAutoDismissTimer()
        ttsAudioAnalyzer.stopSpeechTracking()

        if (_hologramState.value != HologramState.HIDDEN) {
            transitionToState(HologramState.DISMISSING)
            overlayService?.dismissOverlay()
            scope.launch {
                delay(config.dismissDurationMs + 50L)
                transitionToState(HologramState.HIDDEN)
                visualizer.reset()
            }
        }
    }

    private fun transitionToState(newState: HologramState) {
        _hologramState.value = newState
        JarvisLogger.d("HologramController", "Hologram State -> $newState")
    }

    private fun updateOverlayDisplay(state: HologramState, statusText: String, transcript: String = "") {
        overlayService?.updateHologramState(
            state = state,
            statusText = statusText,
            transcriptText = transcript,
            theme = config.themeColor,
            quality = config.quality
        )
    }

    private fun ensureOverlayWindow() {
        if (!config.overlayEnabled) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            JarvisLogger.w("HologramController", "Overlay permission not granted. Hologram will render in in-app HUD only.")
            return
        }

        if (overlayService == null) {
            HologramOverlayService.start(context)
        } else {
            overlayService?.showOverlay()
        }
    }

    private fun scheduleAutoDismiss(delaySec: Int) {
        cancelAutoDismissTimer()
        autoDismissJob = scope.launch {
            delay(delaySec * 1000L)
            JarvisLogger.d("HologramController", "Auto-dismiss timer elapsed after $delaySec s.")
            dismissHologram()
        }
    }

    private fun cancelAutoDismissTimer() {
        autoDismissJob?.cancel()
        autoDismissJob = null
    }

    private fun playHapticFeedback() {
        if (!config.hapticFeedbackEnabled || vibrator == null) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(22, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(22)
            }
        } catch (e: Exception) {
            JarvisLogger.e("HologramController", "Error playing haptic pulse", e)
        }
    }

    private fun playActivationChime() {
        if (!config.activationSoundEnabled || toneGenerator == null) return
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 120)
        } catch (e: Exception) {
            JarvisLogger.e("HologramController", "Error playing tone", e)
        }
    }

    private fun getStatusLabelForState(state: HologramState): String {
        return when (state) {
            HologramState.HIDDEN -> ""
            HologramState.APPEARING -> "J.A.R.V.I.S. EN LIGNE"
            HologramState.IDLE -> "EN ATTENTE..."
            HologramState.LISTENING -> "ÉCOUTE DE LA COMMANDE..."
            HologramState.THINKING -> "RAISONNEMENT JARVIS..."
            HologramState.SPEAKING -> "J.A.R.V.I.S."
            HologramState.DISMISSING -> "VEILLE..."
        }
    }

    companion object {
        lateinit var instance: HologramController
            private set
    }
}
