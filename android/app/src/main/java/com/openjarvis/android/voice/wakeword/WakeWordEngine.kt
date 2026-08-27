package com.openjarvis.android.voice.wakeword

import android.content.Context
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.voice.VoiceState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.CopyOnWriteArraySet

/**
 * High-Level Wake-Word Coordinator for JARVIS.
 * Connects Audio Hardware Capture (AudioCapture) -> Preprocessing (AudioPreprocessor) -> Feature Extraction & Classifier (WakeWordDetector) -> VoiceEngine.
 *
 * Implements anti-false-trigger cooldown, audio focus handover, and full system diagnostics.
 * NOTE: RMS energy is used strictly for VAD gating to save CPU; only genuine phonetic sequence matches with confidence >= threshold trigger detection.
 */
class WakeWordEngine(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Subsystems
    private val audioCapture = AudioCapture(context)
    private val wakeWordDetector = WakeWordDetector(
        activeModel = WakeWordModel.HEY_JARVIS,
        threshold = 0.75f
    )

    private var _isRunning: Boolean = false
    private var _isPaused: Boolean = false
    private var _currentWakeWord: String = "Hey JARVIS"
    private var _sensitivity: Float = 0.5f
    private var _modelStatus: ModelStatus = ModelStatus.UNINITIALIZED

    // Cooldown to prevent multi-triggering from the same speech utterance or acoustic echo
    private var cooldownMs: Long = 2000L
    private var lastTriggerTimestamp: Long = 0L

    // Callbacks
    private val wakeWordListeners = CopyOnWriteArraySet<(phrase: String) -> Unit>()
    private val stateListeners = CopyOnWriteArraySet<(state: VoiceState) -> Unit>()
    private val rmsListeners = CopyOnWriteArraySet<(rmsDb: Float) -> Unit>()
    private val confidenceListeners = CopyOnWriteArraySet<(confidence: Float) -> Unit>()

    init {
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: INITIALIZING")
        loadActiveModel(_currentWakeWord)

        // Wire AudioCapture callbacks to WakeWordDetector
        audioCapture.setOnFrameCapturedListener { frame, rmsDb, isSpeechPresent ->
            rmsListeners.forEach { it(rmsDb) }

            if (_isRunning && !_isPaused) {
                val result = wakeWordDetector.processFrame(frame, isSpeechPresent)
                confidenceListeners.forEach { it(result.confidence) }

                // Periodic or on-change logging for non-zero confidence to maintain clean logs
                if (result.confidence > 0.15f) {
                    JarvisLogger.d("WakeWordEngine", "WakeWordEngine: CONFIDENCE=${String.format("%.2f", result.confidence)}")
                }

                if (result.detected) {
                    handleWakeWordDetection(result)
                }
            }
        }

        audioCapture.setOnErrorListener { errorMsg ->
            JarvisLogger.e("WakeWordEngine", "AudioCapture Error: $errorMsg")
            notifyState(VoiceState.ERROR)
        }
    }

    private fun loadActiveModel(phrase: String) {
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: MODEL_LOADING")
        _modelStatus = ModelStatus.MODEL_LOADING
        val (model, status) = WakeWordModelLoader.loadModelFromAssets(context, phrase)
        _modelStatus = status
        wakeWordDetector.setModel(model)
        if (status == ModelStatus.MODEL_READY) {
            JarvisLogger.i("WakeWordEngine", "WakeWordEngine: MODEL_READY for '${model.phrase}' (${model.phoneticStates.size} states)")
        } else {
            JarvisLogger.w("WakeWordEngine", "WakeWordEngine: MODEL_ERROR loading '${phrase}'")
        }
    }

    fun isRunning(): Boolean = _isRunning && !_isPaused
    fun isPaused(): Boolean = _isPaused
    fun getWakeWord(): String = _currentWakeWord
    fun getSensitivity(): Float = _sensitivity
    fun getThreshold(): Float = wakeWordDetector.threshold
    fun getLastConfidence(): Float = wakeWordDetector.lastConfidence
    fun isModelLoaded(): Boolean = wakeWordDetector.isModelLoaded && (_modelStatus == ModelStatus.MODEL_READY)
    fun isDetectorReady(): Boolean = wakeWordDetector.isDetectorReady && isModelLoaded()
    fun isMicrophoneAvailable(): Boolean = audioCapture.hasRecordPermission()
    fun getModelStatus(): ModelStatus = _modelStatus

    fun isCooldownActive(): Boolean {
        val now = System.currentTimeMillis()
        return (now - lastTriggerTimestamp) < cooldownMs
    }

    fun setWakeWord(wakeWord: String) {
        if (wakeWord.isNotBlank() && wakeWord.trim() != _currentWakeWord) {
            _currentWakeWord = wakeWord.trim()
            loadActiveModel(_currentWakeWord)
        }
    }

    /**
     * Map user sensitivity [0.1 .. 1.0] to internal detection threshold [0.90 .. 0.60].
     * Higher sensitivity -> lower threshold.
     */
    fun setSensitivity(sensitivity: Float) {
        _sensitivity = sensitivity.coerceIn(0.1f, 1.0f)
        val computedThreshold = 0.90f - (_sensitivity * 0.30f)
        wakeWordDetector.threshold = computedThreshold
        JarvisLogger.i("WakeWordEngine", "Sensitivity set to: $_sensitivity -> Wake-Word Threshold = ${String.format("%.2f", computedThreshold)}")
    }

    fun setThreshold(threshold: Float) {
        wakeWordDetector.threshold = threshold.coerceIn(0.50f, 0.95f)
    }

    fun setCooldownMs(cooldownMs: Long) {
        this.cooldownMs = cooldownMs.coerceIn(500L, 5000L)
    }

    fun onWakeWordDetected(listener: (phrase: String) -> Unit) {
        wakeWordListeners.add(listener)
    }

    fun removeWakeWordDetectedListener(listener: (phrase: String) -> Unit) {
        wakeWordListeners.remove(listener)
    }

    fun onStateChange(listener: (state: VoiceState) -> Unit) {
        stateListeners.add(listener)
    }

    fun removeStateListener(listener: (state: VoiceState) -> Unit) {
        stateListeners.remove(listener)
    }

    fun onRmsChanged(listener: (rmsDb: Float) -> Unit) {
        rmsListeners.add(listener)
    }

    fun removeRmsListener(listener: (rmsDb: Float) -> Unit) {
        rmsListeners.remove(listener)
    }

    fun onConfidenceChanged(listener: (confidence: Float) -> Unit) {
        confidenceListeners.add(listener)
    }

    fun removeConfidenceListener(listener: (confidence: Float) -> Unit) {
        confidenceListeners.remove(listener)
    }

    /**
     * Start continuous background wake-word listening loop.
     */
    @Synchronized
    fun start() {
        if (_isRunning) {
            _isPaused = false
            audioCapture.resume()
            return
        }

        _isRunning = true
        _isPaused = false
        wakeWordDetector.reset()
        notifyState(VoiceState.LISTENING_FOR_WAKE_WORD)

        val started = audioCapture.start()
        if (started) {
            JarvisLogger.i("WakeWordEngine", "WakeWordEngine: LISTENING for '$_currentWakeWord' (Threshold: ${String.format("%.2f", wakeWordDetector.threshold)})")
        } else {
            JarvisLogger.e("WakeWordEngine", "Failed to start AudioCapture.")
            notifyState(VoiceState.ERROR)
        }
    }

    /**
     * Pause wake-word listening (e.g. while JARVIS is speaking or processing a command).
     * Stops AudioRecord immediately so SpeechProvider can access the microphone.
     */
    @Synchronized
    fun pause() {
        if (!_isRunning || _isPaused) return
        _isPaused = true
        audioCapture.pause()
        notifyState(VoiceState.PAUSED)
        JarvisLogger.d("WakeWordEngine", "WakeWordEngine: PAUSED")
    }

    /**
     * Resume wake-word listening after command completion.
     */
    @Synchronized
    fun resume() {
        if (!_isRunning) {
            start()
            return
        }
        if (_isPaused) {
            _isPaused = false
            wakeWordDetector.reset()
            audioCapture.resume()
            notifyState(VoiceState.LISTENING_FOR_WAKE_WORD)
            JarvisLogger.d("WakeWordEngine", "WakeWordEngine: RESUMED")
        }
    }

    /**
     * Stop wake-word engine and release audio hardware resources.
     */
    @Synchronized
    fun stop() {
        _isRunning = false
        _isPaused = false
        audioCapture.stop()
        wakeWordDetector.reset()
        notifyState(VoiceState.STOPPED)
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: STOPPED and released.")
    }

    /**
     * Handle true acoustic match from WakeWordDetector.
     */
    private fun handleWakeWordDetection(result: DetectionResult) {
        val now = System.currentTimeMillis()
        if (now - lastTriggerTimestamp < cooldownMs) {
            JarvisLogger.d("WakeWordEngine", "Wake-word detection ignored due to active cooldown (${now - lastTriggerTimestamp}ms < ${cooldownMs}ms).")
            return
        }

        lastTriggerTimestamp = now
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: WAKE_WORD_DETECTED -> '${result.phrase}' (Confidence: ${String.format("%.2f", result.confidence)})")
        
        notifyState(VoiceState.WAKE_WORD_DETECTED)

        wakeWordListeners.forEach { listener ->
            try {
                listener(result.phrase)
            } catch (e: Exception) {
                JarvisLogger.e("WakeWordEngine", "Error in wake word listener", e)
            }
        }
    }

    /**
     * Manual or test trigger for the wake word.
     */
    fun triggerWakeWordDetected(phrase: String = _currentWakeWord) {
        handleWakeWordDetection(DetectionResult(true, 1.0f, phrase))
    }

    /**
     * Phonetic phrase matching against configured wake-words for hybrid/text-based fallback.
     */
    fun testPhrase(rawText: String): Pair<Boolean, String> {
        if (rawText.isBlank()) return Pair(false, "")

        val clean = rawText.trim().lowercase()
        val normalized = clean
            .replace(Regex("\\bj\\.?a\\.?r\\.?v\\.?i\\.?s\\b"), "jarvis")
            .replace(Regex("\\bdjarvis\\b"), "jarvis")
            .replace(Regex("\\bcharvis\\b"), "jarvis")
            .replace(Regex("\\bjarvisse\\b"), "jarvis")
            .replace(Regex("[.,!?:;]+"), " ")
            .trim()

        val candidates = listOf(
            _currentWakeWord.lowercase().trim(),
            "hey jarvis",
            "dis jarvis",
            "ok jarvis",
            "salut jarvis",
            "bonjour jarvis",
            "écoute jarvis",
            "jarvis"
        ).distinct()

        for (candidate in candidates) {
            if (normalized.startsWith(candidate)) {
                val command = normalized.removePrefix(candidate).trim()
                return Pair(true, command)
            } else if (normalized.contains(candidate)) {
                val idx = normalized.indexOf(candidate)
                val command = normalized.substring(idx + candidate.length).trim()
                return Pair(true, command)
            }
        }

        return Pair(false, "")
    }

    private fun notifyState(state: VoiceState) {
        stateListeners.forEach { listener ->
            try {
                listener(state)
            } catch (e: Exception) {
                JarvisLogger.e("WakeWordEngine", "Error in state listener", e)
            }
        }
    }
}
