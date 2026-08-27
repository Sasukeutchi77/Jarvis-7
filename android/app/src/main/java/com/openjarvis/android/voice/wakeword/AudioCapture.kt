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

/**
 * Dedicated Low-Latency Audio Hardware Capture & Robust Preprocessing Pipeline for JARVIS.
 * Streams PCM 16kHz 16-bit Mono audio, connects directly to AudioPreprocessor,
 * and features automatic exponential backoff error recovery for hardware stability.
 */
class AudioCapture(
    private val context: Context,
    val sampleRate: Int = 16000,
    val frameSize: Int = 400,        // 25ms @ 16kHz
    val frameStep: Int = 160,        // 10ms @ 16kHz
    val windowDurationMs: Int = 1200 // 1.2s sliding window
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var captureJob: Job? = null

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var isPaused = false

    val preprocessor = AudioPreprocessor(
        sampleRate = sampleRate,
        frameSize = frameSize,
        frameStep = frameStep,
        windowDurationMs = windowDurationMs
    )

    // Retry recovery counter
    private var consecutiveErrors = 0
    private val maxConsecutiveErrors = 3
    private var isRecovering = false

    // Listeners
    private var onFrameCapturedListener: ((frame: FloatArray, rmsDb: Float, isSpeechPresent: Boolean) -> Unit)? = null
    private var onErrorListener: ((errorMsg: String) -> Unit)? = null

    companion object {
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
    }

    fun isRecording(): Boolean = isRecording && !isPaused
    fun isPaused(): Boolean = isPaused

    fun setOnFrameCapturedListener(listener: (frame: FloatArray, rmsDb: Float, isSpeechPresent: Boolean) -> Unit) {
        this.onFrameCapturedListener = listener
    }

    fun setOnErrorListener(listener: (errorMsg: String) -> Unit) {
        this.onErrorListener = listener
    }

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
                releaseHardware()
                return false
            }

            audioRecord?.startRecording()
            isRecording = true
            isPaused = false
            consecutiveErrors = 0

            captureJob?.cancel()
            captureJob = scope.launch {
                runCaptureLoop(bufferSize)
            }

            JarvisLogger.i("AudioCapture", "AudioCapture running at $sampleRate Hz Mono (Buffer: $bufferSize bytes).")
            return true
        } catch (e: SecurityException) {
            JarvisLogger.e("AudioCapture", "SecurityException during AudioRecord start", e)
            onErrorListener?.invoke("Permission microphone manquante.")
            releaseHardware()
            return false
        } catch (e: Exception) {
            JarvisLogger.e("AudioCapture", "Exception initializing AudioRecord", e)
            onErrorListener?.invoke("Erreur d'initialisation du microphone: ${e.message}")
            releaseHardware()
            return false
        }
    }

    /**
     * Pause audio stream without destroying structures (e.g. during TTS or Command Recognition).
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
            JarvisLogger.e("AudioCapture", "Error pausing AudioRecord: ${e.message}")
        }
        JarvisLogger.d("AudioCapture", "AudioCapture paused.")
    }

    /**
     * Resume audio stream after command recognition or TTS finishes.
     */
    @Synchronized
    fun resume(): Boolean {
        if (!isRecording) {
            return start()
        }
        if (isPaused) {
            try {
                preprocessor.reset()
                audioRecord?.startRecording()
                isPaused = false
                JarvisLogger.d("AudioCapture", "AudioCapture resumed.")
                return true
            } catch (e: Exception) {
                JarvisLogger.e("AudioCapture", "Error resuming AudioRecord, attempting fresh start: ${e.message}")
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
        releaseHardware()
        preprocessor.reset()
        JarvisLogger.i("AudioCapture", "AudioCapture stopped.")
    }

    private fun releaseHardware() {
        try {
            if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord?.stop()
            }
            audioRecord?.release()
        } catch (e: Exception) {
            JarvisLogger.e("AudioCapture", "Error releasing AudioRecord: ${e.message}")
        } finally {
            audioRecord = null
        }
    }

    /**
     * Core capture loop reading raw PCM shorts with zero-allocation buffers.
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
                consecutiveErrors = 0
                val processed = preprocessor.processChunk(rawBuffer, readCount)
                onFrameCapturedListener?.invoke(processed.frame, processed.rmsDb, processed.isSpeechPresent)
            } else if (readCount == AudioRecord.ERROR_INVALID_OPERATION || readCount == AudioRecord.ERROR_BAD_VALUE || readCount == AudioRecord.ERROR_DEAD_OBJECT) {
                consecutiveErrors++
                JarvisLogger.w("AudioCapture", "AudioRecord error code: $readCount (Attempt $consecutiveErrors/$maxConsecutiveErrors)")
                if (consecutiveErrors >= maxConsecutiveErrors && !isRecovering) {
                    triggerHardwareRecovery()
                }
                delay(50)
            }

            // Yield coroutine to keep CPU overhead negligible
            delay(4)
        }
    }

    /**
     * Automatic recovery sequence: STOP -> RELEASE -> WAIT -> REINITIALIZE -> START
     */
    private fun triggerHardwareRecovery() {
        isRecovering = true
        scope.launch {
            JarvisLogger.w("AudioCapture", "Triggering AudioRecord hardware recovery...")
            releaseHardware()
            delay(300)
            consecutiveErrors = 0
            val restarted = start()
            isRecovering = false
            if (restarted) {
                JarvisLogger.i("AudioCapture", "AudioRecord hardware recovery successful.")
            } else {
                JarvisLogger.e("AudioCapture", "AudioRecord hardware recovery failed.")
                onErrorListener?.invoke("Échec de la récupération du microphone.")
            }
        }
    }
}
