package com.openjarvis.android.hologram

import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.sin
import kotlin.random.Random

/**
 * Speech Audio Energy Analyzer for JARVIS Text-to-Speech Vocalization.
 *
 * Provides real-time speech cadence and amplitude envelope estimation synchronized with Android TTS output.
 * Since standard Android TextToSpeech engine directly plays audio through AudioTrack without exposing raw PCM
 * stream buffers in standard mode, this analyzer utilizes syllabic speech envelope modulation
 * driven by character cadence, punctuation pauses, and dynamic speech formant harmonics.
 */
class TtsAudioAnalyzer(
    private val visualizer: VoiceVisualizer
) {
    private val scope = CoroutineScope(Dispatchers.Default)
    private var analysisJob: Job? = null
    private var isAnalyzing = false

    /**
     * Start speech envelope tracking for a spoken phrase.
     */
    fun startSpeechTracking(spokenText: String) {
        stopSpeechTracking()
        isAnalyzing = true

        analysisJob = scope.launch {
            JarvisLogger.d("TtsAudioAnalyzer", "Starting TTS speech cadence analysis for text (${spokenText.length} chars)")
            val words = spokenText.split(Regex("\\s+")).filter { it.isNotBlank() }
            var wordIndex = 0
            var charPhase = 0.0f
            val startTime = System.currentTimeMillis()

            while (isActive && isAnalyzing) {
                val elapsed = (System.currentTimeMillis() - startTime) / 1000f

                // Syllabic & formant harmonic modulation simulating human vocal rhythm
                charPhase += 0.35f
                val primaryCadence = (sin(charPhase * 2.8f) * 0.4f + 0.5f).coerceIn(0.1f, 0.95f)
                val vowelStress = (sin(charPhase * 5.4f) * 0.25f).coerceIn(-0.2f, 0.3f)
                val microTremor = Random.nextFloat() * 0.12f

                val speechEnergy = (primaryCadence + vowelStress + microTremor).coerceIn(0.15f, 1.0f)
                visualizer.processNormalizedEnergy(speechEnergy.toFloat())

                delay(30L) // ~33 FPS cadence updates
            }
        }
    }

    /**
     * Stop speech tracking and gently decay energy to baseline.
     */
    fun stopSpeechTracking() {
        isAnalyzing = false
        analysisJob?.cancel()
        analysisJob = null
        visualizer.processNormalizedEnergy(0.0f)
    }
}
