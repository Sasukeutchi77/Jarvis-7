package com.openjarvis.android.hologram

import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Real-time Voice Visualizer and Acoustic Energy Processor.
 * Converts raw RMS decibels and TTS phoneme energy into smooth volumetric animation parameters
 * for the JARVIS Holographic Core and Orbital Rings.
 */
class VoiceVisualizer {

    companion object {
        const val NUM_FREQUENCY_BARS = 16
        const val MIN_RMS_DB = -60.0f
        const val MAX_RMS_DB = 0.0f
    }

    // Smoothed visualizer properties
    private var _smoothedAmplitude: Float = 0.0f
    val smoothedAmplitude: Float get() = _smoothedAmplitude

    private var _peakAmplitude: Float = 0.0f
    val peakAmplitude: Float get() = _peakAmplitude

    private var _energyPulse: Float = 0.0f
    val energyPulse: Float get() = _energyPulse

    // Pre-allocated array of waveform harmonic bars (0.0 to 1.0)
    val frequencyBands = FloatArray(NUM_FREQUENCY_BARS)

    // Ballistics parameters
    private val attackSpeed = 0.45f
    private val decaySpeed = 0.12f

    private var internalPhase = 0.0f

    /**
     * Ingests microphone RMS dB level (typically -60 dB to 0 dB).
     */
    fun processMicrophoneLevel(rmsDb: Float) {
        val clampedDb = rmsDb.coerceIn(MIN_RMS_DB, MAX_RMS_DB)
        val normalized = ((clampedDb - MIN_RMS_DB) / (MAX_RMS_DB - MIN_RMS_DB)).coerceIn(0.0f, 1.0f)
        updateNormalizedAmplitude(normalized)
    }

    /**
     * Ingests normalized energy (0.0 to 1.0), e.g. from TTS synthesis or mock analyzer.
     */
    fun processNormalizedEnergy(energy: Float) {
        updateNormalizedAmplitude(energy.coerceIn(0.0f, 1.0f))
    }

    private fun updateNormalizedAmplitude(target: Float) {
        // Fast attack, smooth decay filter
        if (target > _smoothedAmplitude) {
            _smoothedAmplitude += (target - _smoothedAmplitude) * attackSpeed
        } else {
            _smoothedAmplitude += (target - _smoothedAmplitude) * decaySpeed
        }

        // Peak tracking
        if (_smoothedAmplitude > _peakAmplitude) {
            _peakAmplitude = _smoothedAmplitude
        } else {
            _peakAmplitude = max(0f, _peakAmplitude - 0.02f)
        }

        // Energy burst trigger
        if (target > 0.65f && _energyPulse < 0.8f) {
            _energyPulse = 1.0f
        } else {
            _energyPulse = max(0f, _energyPulse - 0.08f)
        }
    }

    /**
     * Update harmonic waveform bands for current frame based on time delta and voice energy.
     * Zero-allocation frame loop.
     */
    fun updateFrame(deltaTimeSeconds: Float, isSpeakingOrListening: Boolean) {
        internalPhase += deltaTimeSeconds * 4.0f
        if (internalPhase > 1000.0f) internalPhase = 0.0f

        val baseAmp = if (isSpeakingOrListening) _smoothedAmplitude else 0.05f

        for (i in 0 until NUM_FREQUENCY_BARS) {
            val harmonic1 = sin(internalPhase * 2.2f + i * 0.45f) * 0.35f
            val harmonic2 = cos(internalPhase * 3.8f - i * 0.65f) * 0.25f
            val harmonic3 = sin(internalPhase * 1.5f + i * 0.20f) * 0.20f

            val wave = 0.4f + harmonic1 + harmonic2 + harmonic3
            val barHeight = (baseAmp * wave * 1.5f).coerceIn(0.02f, 1.0f)

            // Smooth interpolation
            frequencyBands[i] += (barHeight - frequencyBands[i]) * 0.3f
        }

        // Natural decay when no voice is input
        if (!isSpeakingOrListening) {
            _smoothedAmplitude = max(0f, _smoothedAmplitude - deltaTimeSeconds * 0.5f)
            _peakAmplitude = max(0f, _peakAmplitude - deltaTimeSeconds * 0.3f)
            _energyPulse = max(0f, _energyPulse - deltaTimeSeconds * 0.8f)
        }
    }

    /**
     * Compute scale multiplier for central nucleus.
     */
    fun calculateCoreScale(): Float {
        return 1.0f + (_smoothedAmplitude * 0.35f) + (_energyPulse * 0.15f)
    }

    /**
     * Compute radial dispersion multiplier for particles.
     */
    fun calculateParticleDispersion(): Float {
        return 1.0f + (_smoothedAmplitude * 0.75f)
    }

    /**
     * Compute orbital rotation speed boost based on voice or thinking state.
     */
    fun calculateSpeedMultiplier(state: HologramState): Float {
        return when (state) {
            HologramState.THINKING -> 3.2f
            HologramState.MEMORY -> 2.4f
            HologramState.SPEAKING -> 1.8f + (_smoothedAmplitude * 1.5f)
            HologramState.LISTENING -> 1.2f + (_smoothedAmplitude * 1.8f)
            HologramState.APPEARING -> 2.0f
            HologramState.IDLE -> 0.6f
            HologramState.DISMISSING -> 0.4f
            HologramState.HIDDEN -> 0.0f
        }
    }

    /**
     * Reset visualizer state to absolute zero.
     */
    fun reset() {
        _smoothedAmplitude = 0f
        _peakAmplitude = 0f
        _energyPulse = 0f
        for (i in 0 until NUM_FREQUENCY_BARS) {
            frequencyBands[i] = 0.05f
        }
    }
}
