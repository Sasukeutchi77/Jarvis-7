package com.openjarvis.android.voice.wakeword

import com.openjarvis.android.logging.JarvisLogger
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Result returned by the Wake-Word Pattern Classifier.
 */
data class DetectionResult(
    val detected: Boolean,
    val confidence: Float,
    val phrase: String,
    val matchedStatesCount: Int = 0,
    val timestampMs: Long = System.currentTimeMillis()
)

/**
 * Interface defining the contract for local acoustic Wake-Word Detectors.
 */
interface IWakeWordDetector {
    var threshold: Float
    val isModelLoaded: Boolean
    val isDetectorReady: Boolean
    val lastConfidence: Float
    val lastDetectionTimestamp: Long

    fun initialize(model: WakeWordModel)
    fun setModel(model: WakeWordModel)
    fun getActiveModel(): WakeWordModel
    fun processFrame(frame: FloatArray, isSpeechPresent: Boolean): DetectionResult
    fun reset()
    fun release()
}

/**
 * Real on-device Acoustic Classifier for "Hey JARVIS".
 * Uses MFCC spectral feature extraction and Dynamic Time Warping (DTW) with phonetic state alignment.
 *
 * Runs 100% locally on Android CPU with zero cloud latency and no continuous network transmission.
 */
class WakeWordDetector(
    private var activeModel: WakeWordModel = WakeWordModel.HEY_JARVIS,
    override var threshold: Float = 0.75f
) : IWakeWordDetector {
    private val acousticFeatures = AcousticFeatures()
    private val mfccDim = acousticFeatures.numCepstra

    // History buffer of MFCC frames (up to 120 frames = 1.2 seconds of speech)
    private val maxHistoryFrames = 120
    private val mfccHistory = Array(maxHistoryFrames) { FloatArray(mfccDim) }
    private var historyCount = 0
    private var historyWriteIndex = 0

    // Pre-allocated DTW cost matrix (120 x 12)
    private val maxModelStates = 12
    private val dtwMatrix = Array(maxHistoryFrames + 1) { FloatArray(maxModelStates + 1) }

    // Diagnostics telemetry
    override var isModelLoaded: Boolean = true
        private set
    override var isDetectorReady: Boolean = true
        private set
    override var lastConfidence: Float = 0.0f
        private set
    override var lastDetectionTimestamp: Long = 0L
        private set

    init {
        initialize(activeModel)
    }

    override fun initialize(model: WakeWordModel) {
        setModel(model)
    }

    @Synchronized
    override fun setModel(model: WakeWordModel) {
        this.activeModel = model
        this.isModelLoaded = model.phoneticStates.isNotEmpty()
        this.isDetectorReady = isModelLoaded
        reset()
        JarvisLogger.i("WakeWordDetector", "Active Wake-word Model set to: '${model.phrase}' (${model.phoneticStates.size} phonetic states)")
    }

    override fun getActiveModel(): WakeWordModel = activeModel

    @Synchronized
    override fun reset() {
        historyCount = 0
        historyWriteIndex = 0
        lastConfidence = 0.0f
    }

    override fun release() {
        reset()
        isDetectorReady = false
    }

    /**
     * Ingest a new 25ms preprocessed audio frame and evaluate the acoustic wake-word match.
     * Note: Pure RMS/Energy NEVER triggers detection. Only a real acoustic alignment with
     * confidence >= threshold triggers a positive match.
     */
    @Synchronized
    override fun processFrame(frame: FloatArray, isSpeechPresent: Boolean): DetectionResult {
        if (!isSpeechPresent) {
            // Silence / environmental noise floor -> decay confidence smoothly
            lastConfidence = (lastConfidence * 0.7f).coerceAtLeast(0.0f)
            return DetectionResult(false, lastConfidence, activeModel.phrase)
        }

        // 1. Extract 13 MFCC coefficients for the incoming frame
        val currentMfcc = mfccHistory[historyWriteIndex]
        acousticFeatures.extractMfcc(frame, currentMfcc)

        historyWriteIndex = (historyWriteIndex + 1) % maxHistoryFrames
        if (historyCount < maxHistoryFrames) {
            historyCount++
        }

        // Need at least 25 frames (~250ms) before evaluating speech
        if (historyCount < 25) {
            return DetectionResult(false, 0.0f, activeModel.phrase)
        }

        // 2. Perform Dynamic Time Warping (DTW) Acoustic Sequence Alignment
        val confidence = computeConfidenceScore()
        lastConfidence = confidence

        val isDetected = confidence >= threshold
        if (isDetected) {
            lastDetectionTimestamp = System.currentTimeMillis()
            JarvisLogger.i("WakeWordDetector", "WakeWordEngine: CONFIDENCE=${String.format("%.2f", confidence)} >= THRESHOLD=${String.format("%.2f", threshold)} -> WAKE_WORD_DETECTED ('${activeModel.phrase}')")
        }

        return DetectionResult(
            detected = isDetected,
            confidence = confidence,
            phrase = activeModel.phrase,
            matchedStatesCount = activeModel.phoneticStates.size,
            timestampMs = System.currentTimeMillis()
        )
    }

    /**
     * Compute acoustic distance & probabilistic confidence score [0.00 .. 1.00]
     * using constrained Dynamic Time Warping across phonetic states.
     */
    private fun computeConfidenceScore(): Float {
        val states = activeModel.phoneticStates
        val nStates = states.size
        val nFrames = min(historyCount, 100) // Evaluate recent 1.0s window

        if (nStates == 0 || nFrames < nStates * 2) {
            return 0.0f
        }

        // Initialize DTW cost matrix
        for (i in 0..nFrames) {
            for (j in 0..nStates) {
                dtwMatrix[i][j] = 1e6f
            }
        }
        dtwMatrix[0][0] = 0f

        // Fill DTW matrix with local slope constraints
        for (i in 1..nFrames) {
            val frameIdx = (historyWriteIndex - nFrames + (i - 1) + maxHistoryFrames) % maxHistoryFrames
            val frameMfcc = mfccHistory[frameIdx]

            for (j in 1..nStates) {
                val state = states[j - 1]
                val localDist = computeWeightedMfccDistance(frameMfcc, state.expectedMfcc) * state.weight

                val costDiag = dtwMatrix[i - 1][j - 1]
                val costUp = dtwMatrix[i - 1][j]
                val costLeft = dtwMatrix[i][j - 1]

                val minPrev = min(costDiag, min(costUp, costLeft))
                dtwMatrix[i][j] = minPrev + localDist
            }
        }

        val totalCost = dtwMatrix[nFrames][nStates]
        val normalizedCost = totalCost / (nFrames + nStates)

        // Non-linear Sigmoid mapping from DTW distance to Probability Confidence [0.0 .. 1.0]
        // Well-matched acoustic templates have normalizedCost in [0.4 .. 1.2]
        // Mismatched / noise / other phrases have normalizedCost > 2.5
        val scale = 2.2f
        val center = 1.4f
        val rawConfidence = (1.0 / (1.0 + exp((normalizedCost - center) * scale))).toFloat()

        // Apply phonetic anchoring penalties:
        // 1. Initial syllable verification (H/EY for "Hey" or D/IY for "Dis")
        val initialMatch = verifyInitialSyllableMatch(nFrames)
        // 2. Final sibilant verification (/s/ for JARVIS)
        val finalSibilantMatch = verifyFinalSibilantMatch(nFrames)

        var finalScore = rawConfidence * (0.6f + 0.2f * initialMatch + 0.2f * finalSibilantMatch)
        return finalScore.coerceIn(0.0f, 1.0f)
    }

    /**
     * Distance between extracted MFCC vector and phonetic target MFCC vector.
     */
    private fun computeWeightedMfccDistance(a: FloatArray, b: FloatArray): Float {
        var sum = 0f
        val n = min(a.size, b.size)
        for (i in 0 until n) {
            val diff = a[i] - b[i]
            // Liftering / coefficient weighting (higher cepstral indices receive modest emphasis)
            val weight = 1.0f + 0.05f * i
            sum += diff * diff * weight
        }
        return sqrt(sum)
    }

    /**
     * Verify energy & spectral features of the initial syllable (prevents triggering on "Jarvis" alone).
     */
    private fun verifyInitialSyllableMatch(nFrames: Int): Float {
        val startWindow = min(20, nFrames / 3)
        var bestMatch = 0f
        val firstStateMfcc = activeModel.phoneticStates.firstOrNull()?.expectedMfcc ?: return 1.0f

        for (i in 0 until startWindow) {
            val frameIdx = (historyWriteIndex - nFrames + i + maxHistoryFrames) % maxHistoryFrames
            val dist = computeWeightedMfccDistance(mfccHistory[frameIdx], firstStateMfcc)
            val match = (1.0f / (1.0f + dist)).coerceIn(0f, 1f)
            if (match > bestMatch) bestMatch = match
        }
        return bestMatch
    }

    /**
     * Verify presence of final high-frequency sibilant (/s/ sound at end of JARVIS).
     */
    private fun verifyFinalSibilantMatch(nFrames: Int): Float {
        val endWindow = min(20, nFrames / 3)
        var bestMatch = 0f
        val lastStateMfcc = activeModel.phoneticStates.lastOrNull()?.expectedMfcc ?: return 1.0f

        for (i in (nFrames - endWindow) until nFrames) {
            val frameIdx = (historyWriteIndex - nFrames + i + maxHistoryFrames) % maxHistoryFrames
            val dist = computeWeightedMfccDistance(mfccHistory[frameIdx], lastStateMfcc)
            val match = (1.0f / (1.0f + dist)).coerceIn(0f, 1f)
            if (match > bestMatch) bestMatch = match
        }
        return bestMatch
    }

    /**
     * Helper for deterministic unit testing on raw audio arrays.
     */
    fun processFullAudioBuffer(samples: FloatArray): DetectionResult {
        reset()
        val frameSize = acousticFeatures.frameSize
        val frameStep = acousticFeatures.frameStep
        var result = DetectionResult(false, 0f, activeModel.phrase)

        var offset = 0
        val tempFrame = FloatArray(frameSize)
        while (offset + frameSize <= samples.size) {
            System.arraycopy(samples, offset, tempFrame, 0, frameSize)

            // Calculate energy
            var sumSquares = 0.0
            for (v in tempFrame) sumSquares += v * v
            val rms = sqrt(sumSquares / frameSize)
            val isSpeech = rms > 0.01f

            result = processFrame(tempFrame, isSpeech)
            if (result.detected) {
                return result
            }
            offset += frameStep
        }
        return result
    }
}

