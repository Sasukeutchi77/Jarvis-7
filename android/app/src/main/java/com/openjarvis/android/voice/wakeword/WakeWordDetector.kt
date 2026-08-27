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
    val matchedTemplateId: String = "",
    val matchedStatesCount: Int = 0,
    val processingTimeMs: Long = 0L,
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
    val lastProcessingTimeMs: Long
    val activeTemplateCount: Int
    val falsePositiveRejectionsCount: Long

    fun initialize(model: WakeWordModel)
    fun setModel(model: WakeWordModel)
    fun getActiveModel(): WakeWordModel
    fun processFrame(frame: FloatArray, isSpeechPresent: Boolean): DetectionResult
    fun reset()
    fun release()
}

/**
 * High-Precision Local Acoustic Template Classifier for "Hey JARVIS".
 * Uses MFCC spectral feature extraction and Dynamic Time Warping (DTW) with multi-template exemplar alignment.
 *
 * NOTE: Runs 100% on-device (zero cloud latency, zero external data transfer).
 * Uses real acoustic DTW matching against validated phonetic templates (Asset / User-Personalized / Compiled).
 */
class WakeWordDetector(
    private var activeModel: WakeWordModel = WakeWordModel.HEY_JARVIS,
    override var threshold: Float = 0.75f
) : IWakeWordDetector {

    private val acousticFeatures = AcousticFeatures()
    private val mfccDim = acousticFeatures.numCepstra

    // History buffer of MFCC frames (up to 120 frames = 1.2 seconds of speech at 10ms frame step)
    private val maxHistoryFrames = 120
    private val mfccHistory = Array(maxHistoryFrames) { FloatArray(mfccDim) }
    private var historyCount = 0
    private var historyWriteIndex = 0

    // Pre-allocated DTW cost matrix (120 frames x 16 states max)
    private val maxModelStates = 16
    private val dtwMatrix = Array(maxHistoryFrames + 1) { FloatArray(maxModelStates + 1) }

    // Diagnostics & Telemetry
    override var isModelLoaded: Boolean = true
        private set
    override var isDetectorReady: Boolean = true
        private set
    override var lastConfidence: Float = 0.0f
        private set
    override var lastDetectionTimestamp: Long = 0L
        private set
    override var lastProcessingTimeMs: Long = 0L
        private set
    override val activeTemplateCount: Int
        get() = if (activeModel.templates.isNotEmpty()) activeModel.templates.size else if (activeModel.phoneticStates.isNotEmpty()) 1 else 0

    override var falsePositiveRejectionsCount: Long = 0L
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
        val hasStates = model.phoneticStates.isNotEmpty() || model.templates.any { it.phoneticStates.isNotEmpty() }
        this.isModelLoaded = hasStates
        this.isDetectorReady = hasStates
        reset()
        JarvisLogger.i("WakeWordDetector", "Active Wake-word Model set to: '${model.phrase}' (${model.sourceType}, ${activeTemplateCount} templates)")
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
     * Ingest a new 25ms preprocessed audio frame and evaluate acoustic wake-word match.
     * Note: Pure RMS/Energy NEVER triggers detection. Only a real acoustic alignment with
     * confidence >= threshold triggers a positive match.
     */
    @Synchronized
    override fun processFrame(frame: FloatArray, isSpeechPresent: Boolean): DetectionResult {
        val startTimeNs = System.nanoTime()

        if (!isSpeechPresent) {
            // Silence / environmental noise floor -> smooth exponential decay of confidence
            lastConfidence = (lastConfidence * 0.70f).coerceAtLeast(0.0f)
            lastProcessingTimeMs = (System.nanoTime() - startTimeNs) / 1_000_000
            return DetectionResult(false, lastConfidence, activeModel.phrase, processingTimeMs = lastProcessingTimeMs)
        }

        // 1. Extract 13-dimensional MFCC vector for the incoming frame
        val currentMfcc = mfccHistory[historyWriteIndex]
        acousticFeatures.extractMfcc(frame, currentMfcc)

        historyWriteIndex = (historyWriteIndex + 1) % maxHistoryFrames
        if (historyCount < maxHistoryFrames) {
            historyCount++
        }

        // Need at least 25 frames (~250ms of accumulated speech) before evaluating phonetic sequence
        if (historyCount < 25 || !isModelLoaded) {
            lastProcessingTimeMs = (System.nanoTime() - startTimeNs) / 1_000_000
            return DetectionResult(false, 0.0f, activeModel.phrase, processingTimeMs = lastProcessingTimeMs)
        }

        // 2. Perform Multi-Template Dynamic Time Warping (DTW) Acoustic Sequence Alignment
        var bestConfidence = 0.0f
        var bestTemplateId = activeModel.id
        var bestStatesCount = activeModel.phoneticStates.size

        val templatesToEvaluate = if (activeModel.templates.isNotEmpty()) {
            activeModel.templates
        } else {
            listOf(
                WakeWordTemplate(
                    id = activeModel.id,
                    label = "Default",
                    phoneticStates = activeModel.phoneticStates,
                    durationFrames = activeModel.totalExpectedFrames
                )
            )
        }

        for (template in templatesToEvaluate) {
            val conf = evaluateTemplateDtw(template)
            if (conf > bestConfidence) {
                bestConfidence = conf
                bestTemplateId = template.id
                bestStatesCount = template.phoneticStates.size
            }
        }

        lastConfidence = bestConfidence
        val isDetected = bestConfidence >= threshold

        if (isDetected) {
            lastDetectionTimestamp = System.currentTimeMillis()
            JarvisLogger.i("WakeWordDetector", "WakeWordEngine: CONFIDENCE=${String.format("%.2f", bestConfidence)} >= THRESHOLD=${String.format("%.2f", threshold)} -> WAKE_WORD_DETECTED ('${activeModel.phrase}' via $bestTemplateId)")
        } else if (bestConfidence > 0.60f && bestConfidence < threshold) {
            // Near-miss or rejected false candidate
            falsePositiveRejectionsCount++
        }

        lastProcessingTimeMs = (System.nanoTime() - startTimeNs) / 1_000_000

        return DetectionResult(
            detected = isDetected,
            confidence = bestConfidence,
            phrase = activeModel.phrase,
            matchedTemplateId = bestTemplateId,
            matchedStatesCount = bestStatesCount,
            processingTimeMs = lastProcessingTimeMs,
            timestampMs = System.currentTimeMillis()
        )
    }

    /**
     * Evaluate DTW alignment for a specific exemplar template.
     */
    private fun evaluateTemplateDtw(template: WakeWordTemplate): Float {
        val states = template.phoneticStates
        val nStates = states.size
        val nFrames = min(historyCount, 100) // Evaluate recent 1.0s window

        if (nStates == 0 || nFrames < nStates * 2) {
            return 0.0f
        }

        // Check bounds against preallocated DTW matrix
        if (nFrames > maxHistoryFrames || nStates > maxModelStates) {
            return 0.0f
        }

        // Initialize DTW cost matrix with infinity
        for (i in 0..nFrames) {
            for (j in 0..nStates) {
                dtwMatrix[i][j] = 1e6f
            }
        }
        dtwMatrix[0][0] = 0f

        // Fill DTW matrix with Sakoe-Chiba band constraints
        val bandWidth = max(4, nFrames / 3)

        for (i in 1..nFrames) {
            val frameIdx = (historyWriteIndex - nFrames + (i - 1) + maxHistoryFrames) % maxHistoryFrames
            val frameMfcc = mfccHistory[frameIdx]

            for (j in 1..nStates) {
                // Slope constraint check: |i - j*(nFrames/nStates)| <= bandWidth
                val expectedFrameForState = (j.toFloat() / nStates) * nFrames
                if (abs(i - expectedFrameForState) > bandWidth) {
                    continue
                }

                val state = states[j - 1]
                val localDist = computeCombinedAcousticDistance(frameMfcc, state.expectedMfcc) * state.weight

                val costDiag = dtwMatrix[i - 1][j - 1]
                val costUp = dtwMatrix[i - 1][j]
                val costLeft = dtwMatrix[i][j - 1]

                val minPrev = min(costDiag, min(costUp, costLeft))
                dtwMatrix[i][j] = minPrev + localDist
            }
        }

        val totalCost = dtwMatrix[nFrames][nStates]
        if (totalCost >= 1e5f) {
            return 0.0f
        }

        val normalizedCost = totalCost / (nFrames + nStates)

        // Mathematical Sigmoid mapping from normalized DTW distance to probability confidence [0.0 .. 1.0]
        // Well-matched acoustic templates have normalizedCost in [0.4 .. 1.2]
        // Mismatched / noise / other phrases have normalizedCost > 2.5
        val scale = 2.4f
        val center = 1.35f
        val rawConfidence = (1.0 / (1.0 + exp((normalizedCost - center) * scale))).toFloat()

        // Syllabic boundary checks:
        // 1. Initial syllable verification ("Hey" / "Dis")
        val initialMatch = verifyInitialSyllableMatch(template, nFrames)
        // 2. Final sibilant verification (/s/ at end of JARVIS)
        val finalSibilantMatch = verifyFinalSibilantMatch(template, nFrames)

        // Balanced composite confidence score
        val finalScore = rawConfidence * (0.60f + 0.20f * initialMatch + 0.20f * finalSibilantMatch)
        return finalScore.coerceIn(0.0f, 1.0f)
    }

    /**
     * Combined Euclidean Liftered + Cosine Spectral Distance.
     * Scale-invariant to volume differences while preserving formant spectral shape.
     */
    private fun computeCombinedAcousticDistance(a: FloatArray, b: FloatArray): Float {
        var dotProduct = 0.0f
        var normA = 0.0f
        var normB = 0.0f
        var euclideanSum = 0.0f

        val n = min(a.size, b.size)
        for (i in 0 until n) {
            val va = a[i]
            val vb = b[i]

            dotProduct += va * vb
            normA += va * va
            normB += vb * vb

            val diff = va - vb
            val cepstralWeight = 1.0f + 0.04f * i // Liftering
            euclideanSum += diff * diff * cepstralWeight
        }

        val denom = sqrt(normA) * sqrt(normB)
        val cosineSimilarity = if (denom > 1e-6f) (dotProduct / denom).coerceIn(-1.0f, 1.0f) else 0.0f
        val cosineDistance = (1.0f - cosineSimilarity) // [0.0 .. 2.0]

        val euclideanDist = sqrt(euclideanSum)

        // 70% Euclidean formants + 30% Cosine shape
        return 0.70f * euclideanDist + 0.30f * cosineDistance
    }

    /**
     * Verify energy & spectral features of the initial syllable (prevents triggering on "Jarvis" alone).
     */
    private fun verifyInitialSyllableMatch(template: WakeWordTemplate, nFrames: Int): Float {
        val startWindow = min(20, nFrames / 3)
        var bestMatch = 0f
        val firstStateMfcc = template.phoneticStates.firstOrNull()?.expectedMfcc ?: return 1.0f

        for (i in 0 until startWindow) {
            val frameIdx = (historyWriteIndex - nFrames + i + maxHistoryFrames) % maxHistoryFrames
            val dist = computeCombinedAcousticDistance(mfccHistory[frameIdx], firstStateMfcc)
            val match = (1.0f / (1.0f + dist)).coerceIn(0f, 1f)
            if (match > bestMatch) bestMatch = match
        }
        return bestMatch
    }

    /**
     * Verify presence of final high-frequency sibilant (/s/ sound at end of JARVIS).
     */
    private fun verifyFinalSibilantMatch(template: WakeWordTemplate, nFrames: Int): Float {
        val endWindow = min(20, nFrames / 3)
        var bestMatch = 0f
        val lastStateMfcc = template.phoneticStates.lastOrNull()?.expectedMfcc ?: return 1.0f

        for (i in (nFrames - endWindow) until nFrames) {
            val frameIdx = (historyWriteIndex - nFrames + i + maxHistoryFrames) % maxHistoryFrames
            val dist = computeCombinedAcousticDistance(mfccHistory[frameIdx], lastStateMfcc)
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
