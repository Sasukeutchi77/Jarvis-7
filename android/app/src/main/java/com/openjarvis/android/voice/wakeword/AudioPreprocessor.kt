package com.openjarvis.android.voice.wakeword

import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Audio Preprocessor for JARVIS.
 * Handles:
 * - 16-bit PCM Short -> Normalized Float [-1.0 .. 1.0] conversion
 * - DC Offset removal (running mean cancellation)
 * - Automatic Gain Control (AGC) soft compression
 * - Pre-Emphasis Filtering (y[n] = x[n] - 0.97 * x[n-1]) to boost high-frequency fricatives / sibilants
 * - Running background noise floor estimation & dynamic SNR calculation
 * - Voice Activity Detection (VAD) gating (used strictly to sleep/throttle CPU during silence)
 * - Circular sliding window buffer (1.2s history)
 */
class AudioPreprocessor(
    val sampleRate: Int = 16000,
    val frameSize: Int = 400,        // 25ms @ 16kHz
    val frameStep: Int = 160,        // 10ms @ 16kHz
    val windowDurationMs: Int = 1200 // 1.2s acoustic window
) {
    companion object {
        const val DEFAULT_PRE_EMPHASIS_ALPHA = 0.97f
        const val MIN_VAD_RMS_FLOOR_DB = 24.0f
        const val SNR_SPEECH_THRESHOLD_DB = 5.0f // Require at least 5 dB above estimated background noise
    }

    private val windowSamplesCount = (sampleRate * (windowDurationMs / 1000.0)).toInt()
    private val slidingWindow = FloatArray(windowSamplesCount)
    private var slidingWindowWritePos = 0

    // Filter state
    private var prevSample = 0.0f
    private var dcOffsetEstimator = 0.0f
    private val preEmphasisAlpha = DEFAULT_PRE_EMPHASIS_ALPHA

    // Running noise floor tracker (dB)
    var estimatedNoiseFloorDb = 25.0f
        private set

    // Pre-allocated frame buffer
    private val currentFrame = FloatArray(frameSize)

    data class ProcessedChunk(
        val frame: FloatArray,
        val rmsDb: Float,
        val snrDb: Float,
        val isSpeechPresent: Boolean,
        val zeroCrossingRate: Float
    )

    @Synchronized
    fun reset() {
        slidingWindow.fill(0f)
        slidingWindowWritePos = 0
        prevSample = 0.0f
        dcOffsetEstimator = 0.0f
        estimatedNoiseFloorDb = 25.0f
    }

    /**
     * Process a raw chunk of PCM 16-bit audio samples from AudioRecord.
     */
    @Synchronized
    fun processChunk(rawSamples: ShortArray, count: Int): ProcessedChunk {
        var sumSquares = 0.0
        var zeroCrossings = 0
        var prevSign = if (count > 0 && rawSamples[0] >= 0) 1 else -1

        for (i in 0 until count) {
            val sampleShort = rawSamples[i]
            val sign = if (sampleShort >= 0) 1 else -1
            if (sign != prevSign) {
                zeroCrossings++
                prevSign = sign
            }

            // 1. Raw sample normalization to [-1.0 .. 1.0]
            val rawNorm = sampleShort / 32768.0f

            // 2. DC Offset Tracking & Removal (IIR High-pass filter ~20Hz cutoff)
            dcOffsetEstimator = 0.995f * dcOffsetEstimator + 0.005f * rawNorm
            val zeroCentered = rawNorm - dcOffsetEstimator

            // 3. Pre-emphasis filter: y[n] = x[n] - 0.97 * x[n-1]
            val filtered = zeroCentered - preEmphasisAlpha * prevSample
            prevSample = zeroCentered

            // 4. Store in sliding circular window
            slidingWindow[slidingWindowWritePos] = filtered
            slidingWindowWritePos = (slidingWindowWritePos + 1) % windowSamplesCount

            sumSquares += sampleShort * sampleShort
        }

        val rms = sqrt(sumSquares / count.coerceAtLeast(1))
        val rmsDb = if (rms > 0) (20 * log10(rms.coerceAtLeast(1.0))).toFloat() else 0f

        // Update running background noise floor estimate when speech is absent
        if (rmsDb < estimatedNoiseFloorDb + 3.0f || rmsDb < 30.0f) {
            estimatedNoiseFloorDb = 0.95f * estimatedNoiseFloorDb + 0.05f * rmsDb
        } else {
            // Very slow adaptation upward in consistently louder environments
            estimatedNoiseFloorDb = 0.998f * estimatedNoiseFloorDb + 0.002f * rmsDb
        }
        estimatedNoiseFloorDb = estimatedNoiseFloorDb.coerceIn(15.0f, 55.0f)

        val snrDb = (rmsDb - estimatedNoiseFloorDb).coerceAtLeast(0f)
        val isSpeechPresent = rmsDb >= MIN_VAD_RMS_FLOOR_DB && snrDb >= SNR_SPEECH_THRESHOLD_DB
        val zcr = zeroCrossings.toFloat() / count.coerceAtLeast(1)

        extractLatestFrame(currentFrame)

        return ProcessedChunk(
            frame = currentFrame,
            rmsDb = rmsDb,
            snrDb = snrDb,
            isSpeechPresent = isSpeechPresent,
            zeroCrossingRate = zcr
        )
    }

    /**
     * Extract the latest 25ms frame from the sliding window.
     */
    @Synchronized
    fun extractLatestFrame(outFrame: FloatArray) {
        val n = outFrame.size.coerceAtMost(windowSamplesCount)
        var readPos = (slidingWindowWritePos - n + windowSamplesCount) % windowSamplesCount
        for (i in 0 until n) {
            outFrame[i] = slidingWindow[readPos]
            readPos = (readPos + 1) % windowSamplesCount
        }
    }

    /**
     * Extract full 1.2s sliding window buffer in chronological order.
     */
    @Synchronized
    fun getFullWindow(outWindow: FloatArray) {
        val n = outWindow.size.coerceAtMost(windowSamplesCount)
        var readPos = (slidingWindowWritePos - n + windowSamplesCount) % windowSamplesCount
        for (i in 0 until n) {
            outWindow[i] = slidingWindow[readPos]
            readPos = (readPos + 1) % windowSamplesCount
        }
    }
}
