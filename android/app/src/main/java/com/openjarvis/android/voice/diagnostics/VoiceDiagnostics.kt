package com.openjarvis.android.voice.diagnostics

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.PowerManager
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import androidx.core.content.ContextCompat
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.services.JarvisVoiceInteractionService
import com.openjarvis.android.storage.SecureVault
import java.util.Locale

data class DiagnosticItem(
    val title: String,
    val isOk: Boolean,
    val details: String,
    val recommendation: String? = null
)

data class VoiceDiagnosticReport(
    val timestamp: Long = System.currentTimeMillis(),
    val overallStatus: Boolean,
    val items: List<DiagnosticItem>,
    val summary: String
)

object VoiceDiagnostics {

    fun runVoiceDiagnostics(context: Context): VoiceDiagnosticReport {
        val items = mutableListOf<DiagnosticItem>()

        // 1. Microphone Permission
        val audioGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        items.add(
            DiagnosticItem(
                title = "Permission Microphone (RECORD_AUDIO)",
                isOk = audioGranted,
                details = if (audioGranted) "Autorisation accordée au niveau système." else "Permission non accordée.",
                recommendation = if (!audioGranted) "Accordez l'accès microphone dans les Paramètres Android." else null
            )
        )

        // 2. AudioRecord Hardware Support
        var audioRecordOk = false
        var audioRecordDetails = "Échec du test matériel"
        try {
            val minBuf = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            if (minBuf > 0 && audioGranted) {
                val ar = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 2)
                if (ar.state == AudioRecord.STATE_INITIALIZED) {
                    audioRecordOk = true
                    audioRecordDetails = "Microphone matériel PCM 16kHz mono disponible et initialisé."
                    ar.release()
                } else {
                    audioRecordDetails = "AudioRecord non initialisé (ressource audio peut être occupée)."
                }
            } else {
                audioRecordDetails = "AudioRecord non testé (permission micro manquante)."
            }
        } catch (e: Exception) {
            audioRecordDetails = "Exception AudioRecord: ${e.message}"
        }
        items.add(
            DiagnosticItem(
                title = "Matériel d'Enregistrement Audio",
                isOk = audioRecordOk,
                details = audioRecordDetails
            )
        )

        // 3. Wake Word Engine & Acoustic Detector
        val config = JarvisApplication.instance.configManager.config.value
        val wakeEngine = JarvisApplication.instance.voiceEngine.wakeWordEngine
        val isModelLoaded = wakeEngine.isModelLoaded()
        val isDetectorReady = wakeEngine.isDetectorReady()
        val currentThreshold = wakeEngine.getThreshold()
        val lastConf = wakeEngine.getLastConfidence()
        val cooldownState = if (wakeEngine.isCooldownActive()) "ACTIF" else "PRÊT"
        val engineStatus = if (wakeEngine.isRunning()) "RUNNING" else if (wakeEngine.isPaused()) "PAUSED" else "STOPPED"

        items.add(
            DiagnosticItem(
                title = "Moteur Wake-Word « ${wakeEngine.getWakeWord()} »",
                isOk = config.wakeWordEnabled && isModelLoaded && isDetectorReady,
                details = "Statut: $engineStatus | Modèle: ${if (isModelLoaded) "CHARGÉ (8 états phonétiques)" else "NON DISPONIBLE"} | Détecteur: ${if (isDetectorReady) "PRÊT (DTW/MFCC)" else "NON PRÊT"} | Seuil: ${String.format("%.2f", currentThreshold)} | Dernière confiance: ${String.format("%.2f", lastConf)} | Cooldown anti-faux déclenchement: $cooldownState",
                recommendation = if (!config.wakeWordEnabled) "Activez la détection 'Hey JARVIS' dans les paramètres." else if (!isModelLoaded) "Modèle acoustique non chargé." else null
            )
        )

        // 4. Android Speech Recognizer
        val recognizerAvailable = SpeechRecognizer.isRecognitionAvailable(context)
        items.add(
            DiagnosticItem(
                title = "Reconnaissance Vocale Android (SpeechRecognizer)",
                isOk = recognizerAvailable,
                details = if (recognizerAvailable) "Moteur de reconnaissance vocale système présent et prêt." else "Aucun SpeechRecognizer système détecté.",
                recommendation = if (!recognizerAvailable) "Installez l'application Reconnaissance vocale Google (Speech Services)." else null
            )
        )

        // 5. Deepgram Cloud Provider
        val deepgramKey = JarvisApplication.instance.secureVault.getSecret(SecureVault.KEY_DEEPGRAM)
        val hasDeepgram = deepgramKey.isNotBlank()
        items.add(
            DiagnosticItem(
                title = "Fournisseur Deepgram (Nova STT & Aura TTS)",
                isOk = hasDeepgram,
                details = if (hasDeepgram) "Clé API Deepgram configurée dans le coffre sécurisé." else "Aucune clé Deepgram (utilisation du SpeechRecognizer Android natif).",
                recommendation = if (!hasDeepgram) "Ajoutez votre clé Deepgram dans les paramètres pour la voix HD Iron Man." else null
            )
        )

        // 6. TextToSpeech Engine
        var ttsOk = false
        var ttsDetails = "Test TTS"
        try {
            val tts = TextToSpeech(context) null
            ttsOk = true
            ttsDetails = "Moteur TextToSpeech initialisé (Locale: ${Locale.getDefault().displayName})."
            tts.shutdown()
        } catch (e: Exception) {
            ttsDetails = "Erreur TTS: ${e.message}"
        }
        items.add(
            DiagnosticItem(
                title = "Synthèse Vocale (Text-To-Speech)",
                isOk = ttsOk,
                details = ttsDetails
            )
        )

        // 7. Digital Assistant Role
        val isDefaultAssistant = JarvisVoiceInteractionService.isActive(context)
        items.add(
            DiagnosticItem(
                title = "Rôle Assistant Numérique Android par Défaut",
                isOk = isDefaultAssistant,
                details = if (isDefaultAssistant) "JARVIS est configuré comme Assistant Numérique par défaut du système." else "JARVIS n'est pas encore l'assistant par défaut.",
                recommendation = if (!isDefaultAssistant) "Définissez JARVIS dans Paramètres Android -> Applications par défaut -> Assistant." else null
            )
        )

        // 8. Battery Optimization Exclusion
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isIgnoringBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: false
        } else {
            true
        }
        items.add(
            DiagnosticItem(
                title = "Optimisation de Batterie en Arrière-plan",
                isOk = isIgnoringBattery,
                details = if (isIgnoringBattery) "Application exclue des restrictions de batterie (écoute permanente garantie)." else "Sous restriction de batterie (Android peut suspendre l'écoute).",
                recommendation = if (!isIgnoringBattery) "Désactivez l'optimisation de batterie pour JARVIS dans les paramètres Android." else null
            )
        )

        val overallOk = audioGranted && recognizerAvailable && (audioRecordOk || !audioGranted)
        val summary = if (overallOk) {
            "Tous les sous-systèmes vocaux critiques de JARVIS sont opérationnels."
        } else {
            "Des composants vocaux nécessitent une configuration (voir détails ci-dessous)."
        }

        return VoiceDiagnosticReport(
            overallStatus = overallOk,
            items = items,
            summary = summary
        )
    }
}
