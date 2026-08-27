package com.openjarvis.android.services

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.logging.JarvisLogger
import java.util.ArrayList

/**
 * Official Android RecognitionService implementation for JARVIS.
 * Provides standard speech recognition integration when selected as the default speech service
 * in Android System Settings.
 */
class JarvisRecognitionService : RecognitionService() {

    private var activeCallback: Callback? = null

    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        activeCallback = listener
        JarvisLogger.i("RecognitionService", "onStartListening requested by Android OS client.")

        val language = recognizerIntent?.getStringExtra(RecognizerIntent.EXTRA_LANGUAGE) ?: "fr-FR"

        try {
            listener?.beginningOfSpeech()

            val voiceEngine = JarvisApplication.instance.voiceEngine
            voiceEngine.speechProvider.startListening(
                language = language,
                onPartialResult = { partial ->
                    val bundle = Bundle().apply {
                        putStringArrayList(
                            SpeechRecognizer.RESULTS_RECOGNITION,
                            ArrayList(listOf(partial))
                        )
                    }
                    try {
                        listener?.partialResults(bundle)
                    } catch (e: Exception) {
                        JarvisLogger.e("RecognitionService", "Error posting partial results", e)
                    }
                },
                onFinalResult = { finalTranscript ->
                    val bundle = Bundle().apply {
                        putStringArrayList(
                            SpeechRecognizer.RESULTS_RECOGNITION,
                            ArrayList(listOf(finalTranscript))
                        )
                    }
                    try {
                        listener?.results(bundle)
                    } catch (e: Exception) {
                        JarvisLogger.e("RecognitionService", "Error posting final results", e)
                    }
                },
                onError = { errorCode, errorMsg ->
                    JarvisLogger.w("RecognitionService", "Speech recognition error: $errorMsg ($errorCode)")
                    try {
                        listener?.error(errorCode)
                    } catch (e: Exception) {
                        JarvisLogger.e("RecognitionService", "Error posting error code", e)
                    }
                },
                onRmsDbChanged = { rmsDb ->
                    try {
                        listener?.rmsChanged(rmsDb)
                    } catch (e: Exception) {
                        // ignore
                    }
                }
            )
        } catch (e: Exception) {
            JarvisLogger.e("RecognitionService", "Failed to start listening in RecognitionService", e)
            listener?.error(SpeechRecognizer.ERROR_CLIENT)
        }
    }

    override fun onCancel(listener: Callback?) {
        JarvisLogger.i("RecognitionService", "onCancel requested.")
        try {
            JarvisApplication.instance.voiceEngine.speechProvider.stopListening()
        } catch (e: Exception) {
            JarvisLogger.e("RecognitionService", "Error onCancel", e)
        } finally {
            activeCallback = null
        }
    }

    override fun onStopListening(listener: Callback?) {
        JarvisLogger.i("RecognitionService", "onStopListening requested.")
        try {
            JarvisApplication.instance.voiceEngine.speechProvider.stopListening()
        } catch (e: Exception) {
            JarvisLogger.e("RecognitionService", "Error onStopListening", e)
        }
    }

    override fun onDestroy() {
        JarvisLogger.i("RecognitionService", "JarvisRecognitionService destroyed.")
        super.onDestroy()
    }
}
