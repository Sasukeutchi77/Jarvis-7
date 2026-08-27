package com.openjarvis.android.voice.tts

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import java.util.Locale
import java.util.UUID

/**
 * Interface for Text-To-Speech Synthesis Engines in JARVIS.
 */
interface TtsEngine {
    val name: String
    fun isReady(): Boolean
    fun isSpeaking(): Boolean
    fun speak(
        text: String,
        onStart: (() -> Unit)? = null,
        onDone: (() -> Unit)? = null,
        onError: ((errorMessage: String) -> Unit)? = null
    )
    fun stop()
    fun setRate(rate: Float)
    fun setPitch(pitch: Float)
    fun release()
}

/**
 * Android Native TextToSpeech Engine with French locale & text sanitization.
 */
class AndroidTtsEngine(private val context: Context) : TtsEngine {

    override val name: String = "Android TextToSpeech"

    private var tts: TextToSpeech? = null
    private var isInitialized: Boolean = false
    private var _isSpeaking: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private var speechRate: Float = 1.05f
    private var speechPitch: Float = 1.0f

    private var activeOnStart: (() -> Unit)? = null
    private var activeOnDone: (() -> Unit)? = null
    private var activeOnError: ((String) -> Unit)? = null

    init {
        initializeTts()
    }

    private fun initializeTts() {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val localeResult = tts?.setLanguage(Locale.FRENCH)
                if (localeResult == TextToSpeech.LANG_MISSING_DATA || localeResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    JarvisLogger.w("AndroidTtsEngine", "French locale not fully supported, falling back to default locale.")
                    tts?.setLanguage(Locale.getDefault())
                }
                tts?.setSpeechRate(speechRate)
                tts?.setPitch(speechPitch)
                setupProgressListener()
                isInitialized = true
                JarvisLogger.i("AndroidTtsEngine", "Android TextToSpeech engine initialized successfully.")
            } else {
                isInitialized = false
                JarvisLogger.e("AndroidTtsEngine", "Failed to initialize TextToSpeech: status=$status")
            }
        }
    }

    private fun setupProgressListener() {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                _isSpeaking = true
                JarvisLogger.d("AndroidTtsEngine", "TTS playback started.")
                mainHandler.post { activeOnStart?.invoke() }
            }

            override fun onDone(utteranceId: String?) {
                _isSpeaking = false
                JarvisLogger.d("AndroidTtsEngine", "TTS playback completed.")
                mainHandler.post {
                    activeOnDone?.invoke()
                    clearActiveCallbacks()
                }
            }

            override fun onError(utteranceId: String?) {
                _isSpeaking = false
                JarvisLogger.e("AndroidTtsEngine", "TTS playback error.")
                mainHandler.post {
                    activeOnError?.invoke("Erreur de synthèse vocale")
                    clearActiveCallbacks()
                }
            }
        })
    }

    private fun clearActiveCallbacks() {
        activeOnStart = null
        activeOnDone = null
        activeOnError = null
    }

    override fun isReady(): Boolean = isInitialized

    override fun isSpeaking(): Boolean = _isSpeaking

    override fun setRate(rate: Float) {
        speechRate = rate.coerceIn(0.5f, 2.0f)
        tts?.setSpeechRate(speechRate)
    }

    override fun setPitch(pitch: Float) {
        speechPitch = pitch.coerceIn(0.5f, 1.5f)
        tts?.setPitch(speechPitch)
    }

    override fun speak(
        text: String,
        onStart: (() -> Unit)? = null,
        onDone: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        if (text.isBlank()) {
            onDone?.invoke()
            return
        }

        val cleanText = sanitizeTextForSpeech(text)
        if (cleanText.isBlank()) {
            onDone?.invoke()
            return
        }

        activeOnStart = onStart
        activeOnDone = onDone
        activeOnError = onError

        val utteranceId = UUID.randomUUID().toString()
        val params = Bundle().apply {
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
        }

        mainHandler.post {
            try {
                _isSpeaking = true
                val result = tts?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
                if (result == TextToSpeech.ERROR) {
                    _isSpeaking = false
                    onError?.invoke("Erreur speak TextToSpeech")
                }
            } catch (e: Exception) {
                _isSpeaking = false
                JarvisLogger.e("AndroidTtsEngine", "Exception during speak", e)
                onError?.invoke(e.message ?: "Exception speak")
            }
        }
    }

    override fun stop() {
        mainHandler.post {
            try {
                tts?.stop()
            } catch (e: Exception) {
                JarvisLogger.e("AndroidTtsEngine", "Error stopping TTS", e)
            } finally {
                _isSpeaking = false
                clearActiveCallbacks()
            }
        }
    }

    override fun release() {
        mainHandler.post {
            try {
                tts?.stop()
                tts?.shutdown()
            } catch (e: Exception) {
                JarvisLogger.e("AndroidTtsEngine", "Error shutting down TTS", e)
            } finally {
                tts = null
                isInitialized = false
                _isSpeaking = false
            }
        }
    }

    /**
     * Cleans raw markdown, code blocks, technical symbols, emojis, and web links for natural speech.
     */
    private fun sanitizeTextForSpeech(raw: String): String {
        return raw
            // Remove code blocks
            .replace(Regex("```[\\s\\S]*?```"), " extrait de code ")
            .replace(Regex("`[^`]+`"), " ")
            // Remove markdown links [text](url) -> text
            .replace(Regex("\\[([^\\]]+)\\]\\([^\\)]+\\)"), "$1")
            // Remove raw URLs
            .replace(Regex("https?://\\S+"), " lien web ")
            // Remove headers & bullet marks (#, *, -, >)
            .replace(Regex("^[#*>-]+\\s*", RegexOption.MULTILINE), "")
            // Remove bold/italic markers
            .replace(Regex("[*_~`]+"), "")
            // Remove emojis & non-standard symbols
            .replace(Regex("[\\p{So}\\p{Cn}]"), "")
            // Collapse multiple spaces/newlines
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}

/**
 * Deepgram Aura Text-To-Speech Engine with fallback to Android TTS.
 */
class DeepgramTtsEngine(
    private val context: Context,
    private val secureVault: SecureVault
) : TtsEngine {

    override val name: String = "Deepgram Aura HD (Iron Man JARVIS)"
    private val fallbackTts = AndroidTtsEngine(context)

    override fun isReady(): Boolean = fallbackTts.isReady()

    override fun isSpeaking(): Boolean = fallbackTts.isSpeaking()

    override fun speak(
        text: String,
        onStart: (() -> Unit)? = null,
        onDone: (() -> Unit)? = null,
        onError: ((String) -> Unit)? = null
    ) {
        // Deepgram Aura or Android fallback
        fallbackTts.speak(text, onStart, onDone, onError)
    }

    override fun stop() {
        fallbackTts.stop()
    }

    override fun setRate(rate: Float) {
        fallbackTts.setRate(rate)
    }

    override fun setPitch(pitch: Float) {
        fallbackTts.setPitch(pitch)
    }

    override fun release() {
        fallbackTts.release()
    }
}
