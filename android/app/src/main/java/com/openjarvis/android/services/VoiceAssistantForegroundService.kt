package com.openjarvis.android.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.MainActivity
import com.openjarvis.android.R
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.voice.VoiceState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Real Android Foreground Service for JARVIS Voice Assistant.
 * Keeps microphone active in the background with FOREGROUND_SERVICE_MICROPHONE,
 * coordinates wake-word detection ("Hey JARVIS"), and provides persistent notification controls.
 */
class VoiceAssistantForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var stateObserverJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification("J.A.R.V.I.S. en veille — Écoute de « Hey JARVIS »"))
        JarvisLogger.i("VoiceService", "VoiceAssistantForegroundService started with microphone foreground type.")

        // Start listening via VoiceEngine
        JarvisApplication.instance.voiceEngine.startBackgroundListening()

        // Observe VoiceState and update Notification text
        stateObserverJob = scope.launch {
            JarvisApplication.instance.voiceEngine.voiceState.collect { state ->
                val statusText = when (state) {
                    VoiceState.IDLE -> "JARVIS en veille"
                    VoiceState.LISTENING_FOR_WAKE_WORD -> "En attente de « ${JarvisApplication.instance.configManager.config.value.wakeWordPhrase} »"
                    VoiceState.WAKE_WORD_DETECTED -> "Mot-clé détecté !"
                    VoiceState.LISTENING_COMMAND -> "Écoute de votre commande..."
                    VoiceState.PROCESSING -> "Raisonnement JARVIS en cours..."
                    VoiceState.SPEAKING -> "Réponse en cours..."
                    VoiceState.PAUSED -> "Écoute vocale en pause"
                    VoiceState.ERROR -> "Erreur sous-système audio"
                    VoiceState.STOPPED -> "Service arrêté"
                }
                updateNotification(statusText)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        when (action) {
            ACTION_STOP -> {
                JarvisLogger.i("VoiceService", "Stop action received from notification.")
                JarvisApplication.instance.voiceEngine.stopBackgroundListening()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_TRIGGER_COMMAND -> {
                JarvisLogger.i("VoiceService", "Trigger command action received.")
                JarvisApplication.instance.voiceEngine.startListeningForCommand()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        JarvisLogger.i("VoiceService", "VoiceAssistantForegroundService stopping.")
        stateObserverJob?.cancel()
        JarvisApplication.instance.voiceEngine.stopBackgroundListening()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_voice_service),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_voice_service_desc)
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun updateNotification(statusText: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildForegroundNotification(statusText))
    }

    private fun buildForegroundNotification(statusText: String): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Action: Stop JARVIS
        val stopIntent = Intent(this, VoiceAssistantForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Action: Speak / Trigger Command
        val speakIntent = Intent(this, VoiceAssistantForegroundService::class.java).apply {
            action = ACTION_TRIGGER_COMMAND
        }
        val speakPendingIntent = PendingIntent.getService(
            this,
            2,
            speakIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("J.A.R.V.I.S. Assistant Vocal")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(openAppPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, getString(R.string.voice_action_stop), stopPendingIntent)
            .addAction(android.R.drawable.ic_btn_speak_now, getString(R.string.voice_action_speak), speakPendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "jarvis_voice_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_STOP = "com.openjarvis.android.ACTION_STOP_VOICE"
        const val ACTION_TRIGGER_COMMAND = "com.openjarvis.android.ACTION_TRIGGER_COMMAND"

        fun start(context: Context) {
            val intent = Intent(context, VoiceAssistantForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, VoiceAssistantForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
