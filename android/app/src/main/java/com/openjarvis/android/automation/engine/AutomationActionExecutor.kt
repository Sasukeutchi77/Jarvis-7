package com.openjarvis.android.automation.engine

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.R
import com.openjarvis.android.automation.model.ActionType
import com.openjarvis.android.automation.model.AutomationAction
import com.openjarvis.android.automation.model.ExecutionResult
import com.openjarvis.android.automation.model.ExecutionStatus
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.hologram.HologramState
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Robust Action Execution Engine for JARVIS Automations.
 * Interacts with Android Hardware, Audio, Telephony, Notifications, TTS, and Hologram.
 */
class AutomationActionExecutor(
    private val context: Context,
    private val secureVault: SecureVault
) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    companion object {
        const val CHANNEL_ID = "jarvis_automations_channel"
    }

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "JARVIS Automations & Rappels"
            val descriptionText = "Notifications et alertes déclenchées par les automatisations JARVIS."
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.createNotificationChannel(channel)
        }
    }

    /**
     * Executes a single AutomationAction in the specified context.
     */
    suspend fun executeAction(
        action: AutomationAction,
        automationId: String,
        automationName: String,
        isTestMode: Boolean = false
    ): Pair<Boolean, String?> = withContext(Dispatchers.IO) {
        val app = JarvisApplication.instance
        val deviceCtrl = app.deviceController

        try {
            when (action.type) {
                ActionType.SHOW_NOTIFICATION -> {
                    val title = action.notificationTitle ?: "J.A.R.V.I.S."
                    val body = action.notificationBody ?: action.message ?: "Automatisation exécutée."
                    showSystemNotification(title, body)
                    Pair(true, null)
                }

                ActionType.SPEAK -> {
                    val textToSpeak = action.message ?: "Automatisation $automationName déclenchée."
                    speakText(textToSpeak)
                    Pair(true, textToSpeak)
                }

                ActionType.OPEN_APP -> {
                    val pkg = action.targetApp ?: action.parameters["package"]
                    if (!pkg.isNullOrBlank()) {
                        val launched = deviceCtrl.appResolver.launchApp(pkg)
                        Pair(launched, if (launched) null else "Application non trouvée : $pkg")
                    } else {
                        Pair(false, "Nom de package manquant.")
                    }
                }

                ActionType.OPEN_SETTINGS -> {
                    val intent = Intent(Settings.ACTION_SETTINGS).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    Pair(true, null)
                }

                ActionType.SET_VOLUME -> {
                    val volume = action.intParam ?: action.parameters["volume"]?.toIntOrNull() ?: 70
                    val result = deviceCtrl.volumeController.setMediaVolume(volume)
                    Pair(result.isSuccess, result.exceptionOrNull()?.message)
                }

                ActionType.SET_BRIGHTNESS -> {
                    val brightness = action.intParam ?: action.parameters["brightness"]?.toIntOrNull() ?: 128
                    val result = deviceCtrl.brightnessController.setBrightness(brightness)
                    Pair(result.isSuccess, result.exceptionOrNull()?.message)
                }

                ActionType.FLASHLIGHT -> {
                    val enable = action.boolParam ?: action.parameters["enable"]?.toBooleanStrictOrNull() ?: true
                    val result = deviceCtrl.flashlightController.setFlashlight(enable)
                    Pair(result.isSuccess, result.exceptionOrNull()?.message)
                }

                ActionType.SEND_SMS -> {
                    val targetNumber = action.phoneNumber ?: action.contactName
                    val msg = action.message ?: ""
                    if (isTestMode) {
                        JarvisLogger.i("ActionExecutor", "[SIMULATION MODE] SMS simulé pour $targetNumber : « $msg »")
                        showSystemNotification("JARVIS [Mode Test]", "SMS simulé vers $targetNumber : « $msg »")
                        Pair(true, "SMS simulé avec succès en Mode Test.")
                    } else {
                        if (!targetNumber.isNullOrBlank()) {
                            val result = deviceCtrl.smsController.sendSms(targetNumber, msg)
                            Pair(result.isSuccess, result.exceptionOrNull()?.message)
                        } else {
                            Pair(false, "Destinataire SMS manquant.")
                        }
                    }
                }

                ActionType.REPLY_NOTIFICATION -> {
                    if (isTestMode) {
                        JarvisLogger.i("ActionExecutor", "[SIMULATION MODE] Réponse notification simulée.")
                        Pair(true, "Réponse de notification simulée en Mode Test.")
                    } else {
                        val replyText = action.message ?: "Message reçu."
                        val replySuccess = app.communicationController.replyToLastNotification(replyText)
                        Pair(replySuccess, if (replySuccess) null else "Aucune notification avec réponse en ligne trouvée.")
                    }
                }

                ActionType.RUN_JARVIS_COMMAND -> {
                    val command = action.command ?: action.message
                    if (!command.isNullOrBlank()) {
                        JarvisLogger.i("ActionExecutor", "Dispatching nested JARVIS query: $command")
                        app.coreBridge.processQuery(command)
                        Pair(true, null)
                    } else {
                        Pair(false, "Commande vocale JARVIS vide.")
                    }
                }

                ActionType.GET_BATTERY_STATUS -> {
                    val result = deviceCtrl.stateManager.getBatteryStatus()
                    val text = "Niveau de batterie : ${result.level}%, statut : ${if (result.isCharging) "En charge" else "Sur batterie"}."
                    speakText(text)
                    Pair(true, text)
                }

                ActionType.GET_WEATHER -> {
                    val weatherText = fetchLiveWeather()
                    speakText(weatherText)
                    Pair(true, weatherText)
                }

                ActionType.SHOW_HOLOGRAM -> {
                    JarvisEventBus.emit(JarvisEvent.StateChanged(com.openjarvis.android.core.events.AgentState.SPEAKING))
                    Pair(true, null)
                }

                ActionType.START_BRIEFING -> {
                    val briefing = buildMorningBriefing()
                    speakText(briefing)
                    showSystemNotification("JARVIS - Briefing Matinal", briefing.take(120) + "...")
                    Pair(true, briefing)
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("ActionExecutor", "Error executing action ${action.type}: ${e.message}")
            Pair(false, e.message)
        }
    }

    private fun showSystemNotification(title: String, body: String) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            val notificationId = (System.currentTimeMillis() % 100000).toInt()
            notificationManager?.notify(notificationId, notification)
        } catch (e: Exception) {
            JarvisLogger.e("ActionExecutor", "Failed to post notification: ${e.message}")
        }
    }

    private suspend fun speakText(text: String) {
        JarvisEventBus.emit(JarvisEvent.ContentStreamChunk(text))
    }

    /**
     * Builds real morning briefing without mocking or inventing fake data.
     */
    private suspend fun buildMorningBriefing(): String {
        val app = JarvisApplication.instance
        val sdfDate = SimpleDateFormat("EEEE d MMMM", Locale.FRANCE)
        val sdfTime = SimpleDateFormat("HH'h'mm", Locale.FRANCE)
        val now = Date()
        val dateStr = sdfDate.format(now)
        val timeStr = sdfTime.format(now)

        val battery = app.deviceController.stateManager.getBatteryStatus()
        val weatherInfo = fetchLiveWeather()

        // Check if user has active project in memory core
        val projectInfo = try {
            val memoryDocs = app.memoryCore.longTermMemory.retrieveRelevantMemories("projet", limit = 1)
            if (memoryDocs.isNotEmpty()) {
                "Concernant vos projets, vous aviez noté : « ${memoryDocs.first().content} »."
            } else ""
        } catch (_: Exception) { "" }

        return buildString {
            append("Bonjour Monsieur. Il est $timeStr, nous sommes le $dateStr. ")
            append("Vos systèmes sont opérationnels. Batterie à ${battery.level}%")
            if (battery.isCharging) append(" (en charge). ") else append(". ")
            append(weatherInfo).append(" ")
            if (projectInfo.isNotBlank()) {
                append(projectInfo).append(" ")
            }
            append("Je reste à votre entière disposition.")
        }
    }

    /**
     * Fetches real weather from OpenWeatherMap API if API key is present in SecureVault,
     * otherwise cleanly informs the user that the weather API key is not configured.
     */
    private suspend fun fetchLiveWeather(): String = withContext(Dispatchers.IO) {
        val weatherApiKey = secureVault.getString("OPENWEATHER_API_KEY", "")
        if (weatherApiKey.isBlank()) {
            return@withContext "Météo non configurée (clé OpenWeatherMap absente des paramètres)."
        }

        try {
            // Fetch for Paris / current approximate locale
            val url = "https://api.openweathermap.org/data/2.5/weather?q=Paris&units=metric&lang=fr&appid=$weatherApiKey"
            val request = Request.Builder().url(url).build()
            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val body = response.body?.string()
                if (body != null) {
                    val json = JSONObject(body)
                    val main = json.getJSONObject("main")
                    val temp = main.getDouble("temp").toInt()
                    val weatherArr = json.getJSONArray("weather")
                    val desc = if (weatherArr.length() > 0) weatherArr.getJSONObject(0).getString("description") else "temps variable"
                    return@withContext "À Paris, le ciel est $desc avec une température actuelle de $temp degrés."
                }
            }
            "Impossible d'actualiser la météo actuellement."
        } catch (e: Exception) {
            JarvisLogger.d("ActionExecutor", "Weather API call failed: ${e.message}")
            "Service météo temporairement indisponible."
        }
    }
}
