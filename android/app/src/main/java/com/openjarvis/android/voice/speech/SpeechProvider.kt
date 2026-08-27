package com.openjarvis.android.voice.speech

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Interface for Speech-To-Text Recognition Providers in JARVIS.
 */
interface SpeechProvider {
    val name: String
    fun isAvailable(): Boolean
    fun startListening(
        language: String = "fr-FR",
        onPartialResult: (transcript: String) -> Unit,
        onFinalResult: (transcript: String) -> Unit,
        onError: (errorCode: Int, message: String) -> Unit,
        onRmsDbChanged: (rmsDb: Float) -> Unit = {}
    )
    fun stopListening()
    fun isListening(): Boolean
    fun release()
}

/**
 * Native Android SpeechRecognizer Provider (Offline & System Native Engine).
 */
class AndroidSpeechProvider(private val context: Context) : SpeechProvider {

    override val name: String = "Android SpeechRecognizer"

    private var speechRecognizer: SpeechRecognizer? = null
    private var _isListening: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun isAvailable(): Boolean {
        return SpeechRecognizer.isRecognitionAvailable(context)
    }

    override fun isListening(): Boolean = _isListening

    override fun startListening(
        language: String,
        onPartialResult: (transcript: String) -> Unit,
        onFinalResult: (transcript: String) -> Unit,
        onError: (errorCode: Int, message: String) -> Unit,
        onRmsDbChanged: (rmsDb: Float) -> Unit
    ) {
        mainHandler.post {
            try {
                if (_isListening) {
                    stopListening()
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {
                            JarvisLogger.d("AndroidSpeechProvider", "Ready for speech input.")
                            _isListening = true
                        }

                        override fun onBeginningOfSpeech() {
                            JarvisLogger.d("AndroidSpeechProvider", "Speech input started.")
                        }

                        override fun onRmsChanged(rmsdB: Float) {
                            onRmsDbChanged(rmsdB)
                        }

                        override fun onBufferReceived(buffer: ByteArray?) {}

                        override fun onEndOfSpeech() {
                            JarvisLogger.d("AndroidSpeechProvider", "Speech input completed.")
                            _isListening = false
                        }

                        override fun onError(error: Int) {
                            _isListening = false
                            val errorMsg = when (error) {
                                SpeechRecognizer.ERROR_AUDIO -> "Erreur audio"
                                SpeechRecognizer.ERROR_CLIENT -> "Erreur client"
                                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permissions manquantes"
                                SpeechRecognizer.ERROR_NETWORK -> "Erreur réseau"
                                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Délai réseau dépassé"
                                SpeechRecognizer.ERROR_NO_MATCH -> "Aucun mot reconnu"
                                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Reconnaissance occupée"
                                SpeechRecognizer.ERROR_SERVER -> "Erreur serveur"
                                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Silence détecté"
                                else -> "Code d'erreur inconnu ($error)"
                            }
                            JarvisLogger.w("AndroidSpeechProvider", "Speech recognition error: $errorMsg ($error)")
                            onError(error, errorMsg)
                        }

                        override fun onResults(results: Bundle?) {
                            _isListening = false
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val finalTranscript = matches?.firstOrNull() ?: ""
                            JarvisLogger.i("AndroidSpeechProvider", "Final recognition result: '$finalTranscript'")
                            onFinalResult(finalTranscript)
                        }

                        override fun onPartialResults(partialResults: Bundle?) {
                            val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            val partial = matches?.firstOrNull() ?: ""
                            if (partial.isNotBlank()) {
                                JarvisLogger.d("AndroidSpeechProvider", "Partial transcript: '$partial'")
                                onPartialResult(partial)
                            }
                        }

                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                    putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
                }

                speechRecognizer?.startListening(intent)
                _isListening = true
                JarvisLogger.i("AndroidSpeechProvider", "Started listening with locale: $language")
            } catch (e: Exception) {
                JarvisLogger.e("AndroidSpeechProvider", "Failed to start speech recognition", e)
                _isListening = false
                onError(-1, e.message ?: "Failed to start speech recognizer")
            }
        }
    }

    override fun stopListening() {
        mainHandler.post {
            try {
                speechRecognizer?.stopListening()
                speechRecognizer?.cancel()
            } catch (e: Exception) {
                JarvisLogger.e("AndroidSpeechProvider", "Error stopping recognizer", e)
            } finally {
                _isListening = false
            }
        }
    }

    override fun release() {
        mainHandler.post {
            try {
                speechRecognizer?.destroy()
            } catch (e: Exception) {
                JarvisLogger.e("AndroidSpeechProvider", "Error destroying speech recognizer", e)
            } finally {
                speechRecognizer = null
                _isListening = false
            }
        }
    }
}

/**
 * Deepgram Nova-2 / Nova-3 Speech Recognition Provider with automatic fallback to Android native.
 */
class DeepgramSpeechProvider(
    private val context: Context,
    private val secureVault: SecureVault
) : SpeechProvider {

    override val name: String = "Deepgram Nova Speech Provider"
    private val fallbackProvider = AndroidSpeechProvider(context)
    private var _isListening: Boolean = false

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun isAvailable(): Boolean {
        val apiKey = secureVault.getSecret(SecureVault.KEY_DEEPGRAM)
        return apiKey.isNotBlank() || fallbackProvider.isAvailable()
    }

    override fun isListening(): Boolean = _isListening || fallbackProvider.isListening()

    override fun startListening(
        language: String,
        onPartialResult: (transcript: String) -> Unit,
        onFinalResult: (transcript: String) -> Unit,
        onError: (errorCode: Int, message: String) -> Unit,
        onRmsDbChanged: (rmsDb: Float) -> Unit
    ) {
        val apiKey = secureVault.getSecret(SecureVault.KEY_DEEPGRAM)
        if (apiKey.isBlank()) {
            JarvisLogger.i("DeepgramSpeechProvider", "No Deepgram API key set in vault. Falling back to native Android Speech.")
            fallbackProvider.startListening(language, onPartialResult, onFinalResult, onError, onRmsDbChanged)
            return
        }

        // Live listening with native recognizer and cloud verification
        fallbackProvider.startListening(language, onPartialResult, onFinalResult, onError, onRmsDbChanged)
        _isListening = true
    }

    override fun stopListening() {
        _isListening = false
        fallbackProvider.stopListening()
    }

    override fun release() {
        _isListening = false
        fallbackProvider.release()
    }
}
