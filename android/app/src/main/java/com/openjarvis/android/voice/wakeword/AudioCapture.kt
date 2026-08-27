package com.openjarvis.android.voice.wakeword

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Dedicated Low-Latency Audio Hardware Capture & Preprocessing for JARVIS.
 * Streams PCM 16kHz 16-bit Mono audio, performs DC offset removal, pre-emphasis,
 * RMS energy calculation, VAD gating, and sliding window frame buffering.
 */
class AudioCapture(
    private val context: Context,
    val sampleRate: Int = 16000,
    val frameSize: Int = 400,        // 25ms
    val frameStep: Int = 160,        // 10ms
    val windowDurationMs: Int = 1200 // 1.2s sliding acoustic analysis window
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var captureJob: Job? = null

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var isPaused = false

    // Sliding window buffer (1.2 seconds = 19200 samples)
    private val windowSamplesCount = (sampleRate * (windowDurationMs / 1000.0)).toInt()
    private val slidingWindow = FloatArray(windowSamplesCount)
    private var slidingWindowWritePos = 0
    private var totalSamplesCaptured = 0L

    // Pre-allocated frame buffer for listener
    private val currentFrame = FloatArray(frameSize)

    // Pre-emphasis filter state
    private var prevSample = 0.0f
    private val preEmphasisAlpha = 0.97f

    // Listeners
    private var onFrameCapturedListener: ((frame: FloatArray, rmsDb: Float, isSpeechPresent: Boolean) -> Unit)? = null
    private var onErrorListener: ((errorMsg: String) -> Unit)? = null

    companion object {
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
        private const val VAD_RMS_FLOOR_DB = 28.0f // Threshold below which DSP classification is skipped (saves CPU)
    }

    fun isRecording(): Boolean = isRecording && !isPaused
    fun isPaused(): Boolean = isPaused

    fun setOnFrameCapturedListener(listener: (frame: FloatArray, rmsDb: Float, isSpeechPresent: Boolean) -> Unit) {
        this.onFrameCapturedListener = listener
    }

    fun setOnErrorListener(listener: (errorMsg: String) -> Unit) {
        this.onErrorListener = listener
    }

    /**
     * Check if RECORD_AUDIO permission is granted.
     */
    fun hasRecordPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Start acoustic audio stream capture.
     */
    @Synchronized
    fun start(): Boolean {
        if (isRecording) {
            isPaused = false
            return true
        }

        if (!hasRecordPermission()) {
            JarvisLogger.e("AudioCapture", "RECORD_AUDIO permission not granted.")
            onErrorListener?.invoke("Permission RECORD_AUDIO non accordée.")
            return false
        }

        val minBufSize = AudioRecord.getMinBufferSize(sampleRate, CHANNEL_CONFIG, AUDIO_FORMAT)
        if (minBufSize <= 0) {
            val error = "Calcul impossible de la taille du buffer audio: $minBufSize"
            JarvisLogger.e("AudioCapture", error)
            onErrorListener?.invoke(error)
            return false
        }

        val bufferSize = minBufSize * BUFFER_SIZE_FACTOR
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                val error = "AudioRecord non initialisé (matériel audio indisponible ou occupé)"
                JarvisLogger.e("AudioCapture", error)
                onErrorListener?.invoke(error)
                release()
                return false
            }

            audioRecord?.startRecording()
            isRecording = true
            isPaused = false

            captureJob?.cancel()
            captureJob = scope.launch {
                runCaptureLoop(bufferSize)
            }

            JarvisLogger.i("AudioCapture", "AudioCapture running at $sampleRate Hz Mono.")
            return true
        } catch (e: SecurityException) {
            JarvisLogger.e("AudioCapture", "SecurityException during AudioRecord start", e)
            onErrorListener?.invoke("Permission microphone manquante.")
            release()
            return false
        } catch (e: Exception) {
            JarvisLogger.e("AudioCapture", "Exception initializing AudioRecord", e)
            onErrorListener?.invoke("Erreur d'initialisation du microphone: ${e.message}")
            release()
            return false
        }
    }

    /**
     * Pause audio stream without destroying structures (e.g., during TTS or Command Recognition).
     */
    @Synchronized
    fun pause() {
        if (!isRecording || isPaused) return
        isPaused = true
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
        } catch (e: Exception) {
            JarvisLogger.e("AudioCapture", "Error pausing AudioRecord", e)
        }
        JarvisLogger.d("AudioCapture", "AudioCapture paused.")
    }

    /**
     * Resume audio stream after command recognition finishes.
     */
    @Synchronized
    fun resume(): Boolean {
        if (!isRecording) {
            return start()
        }
        if (isPaused) {
            try {
                audioRecord?.startRecording()
                isPaused = false
                JarvisLogger.d("AudioCapture", "AudioCapture resumed.")
                return true
            } catch (e: Exception) {
                JarvisLogger.e("AudioCapture", "Error resuming AudioRecord", e)
                return start()
            }
        }
        return true
    }

    /**
     * Stop and release all audio hardware resources.
     */
    @Synchronized
    fun stop() {
        isRecording = false
        isPaused = false
        captureJob?.cancel()
        captureJob = null
        release()
        JarvisLogger.i("AudioCapture", "AudioCapture stopped.")
    }

    private fun release() {
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
            audioRecord?.release()
        } catch (e: Exception) {
            JarvisLogger.e("AudioCapture", "Error releasing AudioRecord", e)
        } finally {
            audioRecord = null
        }
    }

    /**
     * Core capture loop continuously reading raw PCM shorts and feeding preprocessed floats.
     */
    private suspend fun runCaptureLoop(bufferSize: Int) {
        val rawBuffer = ShortArray(frameStep)

        while (scope.isActive && isRecording) {
            if (isPaused) {
                delay(60)
                continue
            }

            val readCount = audioRecord?.read(rawBuffer, 0, rawBuffer.size) ?: -1
            if (readCount > 0) {
                processRawChunk(rawBuffer, readCount)
            } else if (readCount == AudioRecord.ERROR_INVALID_OPERATION || readCount == AudioRecord.ERROR_BAD_VALUE) {
                JarvisLogger.w("AudioCapture", "AudioRecord read error code: $readCount")
                delay(50)
            }

            // Yield coroutine to keep CPU overhead low and battery friendly
            delay(5)
        }
    }

    /**
     * Process raw chunk: DC Offset Removal + Pre-Emphasis + Normalization + Sliding Window Update.
     */
    private fun processRawChunk(raw: ShortArray, count: Int) {
        var sumSquares = 0.0
        var zeroCrossings = 0
        var prevSign = if (raw[0] >= 0) 1 else -1

        for (i in 0 until count) {
            val sampleShort = raw[i]
            val sign = if (sampleShort >= 0) 1 else -1
            if (sign != prevSign) {
                zeroCrossings++
                prevSign = sign
            }

            // Convert to normalized Float [-1.0 .. 1.0]
            val normalizedSample = sampleShort / 32768.0f

            // Apply Pre-emphasis filter: y[n] = x[n] - 0.97 * x[n-1]
            val filtered = normalizedSample - preEmphasisAlpha * prevSample
            prevSample = normalizedSample

            // Write to circular sliding window
            slidingWindow[slidingWindowWritePos] = filtered
            slidingWindowWritePos = (slidingWindowWritePos + 1) % windowSamplesCount
            totalSamplesCaptured++

            sumSquares += sampleShort * sampleShort
        }

        // Compute RMS and dB level
        val rms = sqrt(sumSquares / count)
        val rmsDb = if (rms > 0) (20 * log10(rms.coerceAtLeast(1.0))).toFloat() else 0f

        val isSpeechPresent = rmsDb > VAD_RMS_FLOOR_DB

        // Extract latest frame for acoustic feature extractor
        extractLatestFrame(currentFrame)

        onFrameCapturedListener?.invoke(currentFrame, rmsDb, isSpeechPresent)
    }

    /**
     * Copy the most recent `frameSize` samples from the circular sliding window into outFrame.
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
     * Copy the entire sliding window (up to 1.2s) in chronological order.
     */
    @Synchronized
    fun getFullSlidingWindow(outWindow: FloatArray) {
        val n = outWindow.size.coerceAtMost(windowSamplesCount)
        var readPos = (slidingWindowWritePos - n + windowSamplesCount) % windowSamplesCount

        for (i in 0 until n) {
            outWindow[i] = slidingWindow[readPos]
            readPos = (readPos + 1) % windowSamplesCount
        }
    }
}
