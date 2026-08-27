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
import kotlin.math.max
import kotlin.math.min

/**
 * High-Level Wake-Word Coordinator for JARVIS.
 * Connects Audio Hardware Capture (AudioCapture) -> Preprocessing (AudioPreprocessor) -> Feature Extraction & Classifier (WakeWordDetector) -> VoiceEngine.
 *
 * Implements anti-false-trigger cooldown, audio focus handover, multi-template DTW alignment,
 * personalized voice profile training, and full system diagnostics.
 *
 * NOTE: RMS energy is used strictly for VAD gating to save CPU; only genuine phonetic sequence matches with confidence >= threshold trigger detection.
 */
class WakeWordEngine(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var ttsResumeJob: Job? = null

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
    private var _baseThreshold: Float = 0.75f
    private var _isAdaptiveThresholdEnabled: Boolean = true

    // Cooldown to prevent multi-triggering from the same speech utterance or acoustic echo
    private var cooldownMs: Long = 2000L
    private var lastTriggerTimestamp: Long = 0L

    // Telemetry & Benchmark stats
    private var totalEvaluatedFrames = 0L
    private var sumProcessingTimeMs = 0L
    private var sumConfidence = 0.0
    private var minConfidence = 1.0f
    private var maxConfidence = 0.0f

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
                // Apply adaptive thresholding based on background noise
                if (_isAdaptiveThresholdEnabled) {
                    val noiseFloor = audioCapture.preprocessor.estimatedNoiseFloorDb
                    val noiseAdjustment = if (noiseFloor > 35.0f) {
                        ((noiseFloor - 35.0f) * 0.002f).coerceAtMost(0.04f)
                    } else 0f
                    wakeWordDetector.threshold = (_baseThreshold + noiseAdjustment).coerceIn(0.65f, 0.88f)
                }

                val result = wakeWordDetector.processFrame(frame, isSpeechPresent)
                confidenceListeners.forEach { it(result.confidence) }

                // Telemetry accumulation
                if (isSpeechPresent) {
                    totalEvaluatedFrames++
                    sumProcessingTimeMs += result.processingTimeMs
                    sumConfidence += result.confidence
                    minConfidence = min(minConfidence, result.confidence)
                    maxConfidence = max(maxConfidence, result.confidence)
                }

                // Controlled debug logging
                if (result.confidence > 0.35f) {
                    JarvisLogger.d("WakeWordEngine", "WakeWordDetector: CONFIDENCE=${String.format("%.2f", result.confidence)} (Threshold: ${String.format("%.2f", wakeWordDetector.threshold)})")
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
        val model = WakeWordModelLoader.loadModel(context, phrase)
        wakeWordDetector.setModel(model)
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: ${model.sourceType} for '${model.phrase}' (${wakeWordDetector.activeTemplateCount} templates)")
    }

    fun isRunning(): Boolean = _isRunning && !_isPaused
    fun isPaused(): Boolean = _isPaused
    fun getWakeWord(): String = _currentWakeWord
    fun getSensitivity(): Float = _sensitivity
    fun getThreshold(): Float = wakeWordDetector.threshold
    fun getBaseThreshold(): Float = _baseThreshold
    fun getLastConfidence(): Float = wakeWordDetector.lastConfidence
    fun getLastProcessingTimeMs(): Long = wakeWordDetector.lastProcessingTimeMs
    fun getActiveTemplateCount(): Int = wakeWordDetector.activeTemplateCount
    fun getFalsePositivesCount(): Long = wakeWordDetector.falsePositiveRejectionsCount
    fun isModelLoaded(): Boolean = wakeWordDetector.isModelLoaded
    fun isDetectorReady(): Boolean = wakeWordDetector.isDetectorReady && isModelLoaded()
    fun isMicrophoneAvailable(): Boolean = audioCapture.hasRecordPermission()
    fun getModelSourceType(): ModelSourceType = wakeWordDetector.getActiveModel().sourceType
    fun getEstimatedNoiseFloorDb(): Float = audioCapture.preprocessor.estimatedNoiseFloorDb
    fun isAdaptiveThresholdEnabled(): Boolean = _isAdaptiveThresholdEnabled

    fun isCooldownActive(): Boolean {
        val now = System.currentTimeMillis()
        return (now - lastTriggerTimestamp) < cooldownMs
    }

    fun getCooldownRemainingMs(): Long {
        val now = System.currentTimeMillis()
        val elapsed = now - lastTriggerTimestamp
        return if (elapsed < cooldownMs) cooldownMs - elapsed else 0L
    }

    fun setWakeWord(wakeWord: String) {
        if (wakeWord.isNotBlank() && wakeWord.trim() != _currentWakeWord) {
            _currentWakeWord = wakeWord.trim()
            loadActiveModel(_currentWakeWord)
        }
    }

    /**
     * Map user sensitivity [0.1 .. 1.0] to base detection threshold [0.88 .. 0.62].
     */
    fun setSensitivity(sensitivity: Float) {
        _sensitivity = sensitivity.coerceIn(0.1f, 1.0f)
        _baseThreshold = 0.88f - (_sensitivity * 0.26f)
        wakeWordDetector.threshold = _baseThreshold
        JarvisLogger.i("WakeWordEngine", "Sensitivity set to: $_sensitivity -> Base Threshold = ${String.format("%.2f", _baseThreshold)}")
    }

    fun setThreshold(threshold: Float) {
        _baseThreshold = threshold.coerceIn(0.50f, 0.95f)
        wakeWordDetector.threshold = _baseThreshold
    }

    fun setAdaptiveThresholdEnabled(enabled: Boolean) {
        _isAdaptiveThresholdEnabled = enabled
    }

    fun setCooldownMs(cooldownMs: Long) {
        this.cooldownMs = cooldownMs.coerceIn(500L, 5000L)
    }

    /**
     * Train personalized user voice templates from recorded audio frames ("Train My Voice").
     */
    fun trainUserVoiceTemplate(label: String, recordedFrames: List<FloatArray>): Boolean {
        if (recordedFrames.size < 15) return false
        val acousticFeatures = AcousticFeatures()

        // Cluster and segment frames into 8 phonetic states
        val nStates = 8
        val framesPerState = recordedFrames.size / nStates
        val extractedStates = mutableListOf<PhoneticState>()

        for (s in 0 until nStates) {
            val startIdx = s * framesPerState
            val endIdx = min(recordedFrames.size, startIdx + framesPerState)
            val avgMfcc = FloatArray(acousticFeatures.numCepstra)

            for (f in startIdx until endIdx) {
                val mfcc = FloatArray(acousticFeatures.numCepstra)
                acousticFeatures.extractMfcc(recordedFrames[f], mfcc)
                for (c in 0 until acousticFeatures.numCepstra) {
                    avgMfcc[c] += mfcc[c]
                }
            }

            val count = max(1, endIdx - startIdx)
            for (c in 0 until acousticFeatures.numCepstra) {
                avgMfcc[c] /= count
            }

            extractedStates.add(
                PhoneticState(
                    name = "P_STATE_$s",
                    expectedMfcc = avgMfcc,
                    weight = 1.1f,
                    minFrames = 2,
                    maxFrames = 18
                )
            )
        }

        val templateId = "user_template_${System.currentTimeMillis()}"
        val template = WakeWordTemplate(
            id = templateId,
            label = label,
            phoneticStates = extractedStates,
            durationFrames = recordedFrames.size,
            sampleRate = 16000,
            isUserPersonalized = true
        )

        val saved = WakeWordModelLoader.saveUserPersonalizedTemplate(context, _currentWakeWord, template)
        if (saved) {
            loadActiveModel(_currentWakeWord)
        }
        return saved
    }

    fun clearPersonalizedTemplates(): Boolean {
        val cleared = WakeWordModelLoader.clearUserPersonalizedTemplates(context)
        if (cleared) {
            loadActiveModel(_currentWakeWord)
        }
        return cleared
    }

    // Telemetry Benchmark metrics
    fun getBenchmarkStats(): Map<String, Any> {
        val avgLatency = if (totalEvaluatedFrames > 0) sumProcessingTimeMs.toFloat() / totalEvaluatedFrames else 0f
        val avgConf = if (totalEvaluatedFrames > 0) (sumConfidence / totalEvaluatedFrames).toFloat() else 0f

        return mapOf(
            "totalEvaluatedFrames" to totalEvaluatedFrames,
            "averageProcessingTimeMs" to avgLatency,
            "averageConfidence" to avgConf,
            "minConfidence" to if (totalEvaluatedFrames > 0) minConfidence else 0f,
            "maxConfidence" to if (totalEvaluatedFrames > 0) maxConfidence else 0f,
            "falsePositivesCount" to wakeWordDetector.falsePositiveRejectionsCount,
            "noiseFloorDb" to audioCapture.preprocessor.estimatedNoiseFloorDb
        )
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
        ttsResumeJob?.cancel()
        if (!_isRunning || _isPaused) return
        _isPaused = true
        audioCapture.pause()
        notifyState(VoiceState.PAUSED)
        JarvisLogger.d("WakeWordEngine", "WakeWordEngine: PAUSED")
    }

    /**
     * Specialized pause during TTS to prevent audio loopback / acoustic self-triggering.
     */
    @Synchronized
    fun pauseForTts() {
        pause()
    }

    /**
     * Resume wake-word listening with acoustic settling delay to prevent echo pickup from speaker.
     */
    @Synchronized
    fun resumeAfterTts(acousticSettlingDelayMs: Long = 350L) {
        ttsResumeJob?.cancel()
        ttsResumeJob = scope.launch {
            delay(acousticSettlingDelayMs)
            resume()
        }
    }

    /**
     * Resume wake-word listening after command completion.
     */
    @Synchronized
    fun resume() {
        ttsResumeJob?.cancel()
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
        ttsResumeJob?.cancel()
        _isRunning = false
        _isPaused = false
        lastTriggerTimestamp = 0L
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
        JarvisLogger.i("WakeWordEngine", "WakeWordEngine: WAKE_WORD_DETECTED -> '${result.phrase}' (Confidence: ${String.format("%.2f", result.confidence)}, Template: ${result.matchedTemplateId})")
        
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
        handleWakeWordDetection(DetectionResult(true, 1.0f, phrase, matchedTemplateId = "manual_trigger"))
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
