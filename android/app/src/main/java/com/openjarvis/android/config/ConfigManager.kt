package com.openjarvis.android.config

import android.content.Context
import android.content.SharedPreferences
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ConfigManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("openjarvis_config", Context.MODE_PRIVATE)

    private val _config = MutableStateFlow(loadConfig())
    val config: StateFlow<JarvisConfig> = _config.asStateFlow()

    private fun loadConfig(): JarvisConfig {
        val modeStr = prefs.getString("execution_mode", ExecutionMode.HYBRID.name) ?: ExecutionMode.HYBRID.name
        val mode = try { ExecutionMode.valueOf(modeStr) } catch (e: Exception) { ExecutionMode.HYBRID }

        return JarvisConfig(
            executionMode = mode,
            localModelPath = prefs.getString("local_model_path", "") ?: "",
            lanServerUrl = prefs.getString("lan_server_url", "http://192.168.1.100:11434") ?: "http://192.168.1.100:11434",
            defaultCloudModel = prefs.getString("default_cloud_model", "gemini-2.5-flash") ?: "gemini-2.5-flash",
            wakeWordEnabled = prefs.getBoolean("wake_word_enabled", true),
            wakeWordPhrase = prefs.getString("wake_word_phrase", "Hey JARVIS") ?: "Hey JARVIS",
            wakeWordSensitivity = prefs.getFloat("wake_word_sensitivity", 0.5f),
            wakeWordThreshold = prefs.getFloat("wake_word_threshold", 0.75f),
            wakeWordCooldownSec = prefs.getFloat("wake_word_cooldown_sec", 2.0f),
            backgroundListening = prefs.getBoolean("background_listening", true),
            commandTimeoutSec = prefs.getInt("command_timeout_sec", 7),
            ttsVoiceProvider = prefs.getString("tts_voice_provider", "android_native") ?: "android_native",
            maxTurns = prefs.getInt("max_turns", 10),
            ragTopK = prefs.getInt("rag_top_k", 5)
        )
    }

    fun updateConfig(newConfig: JarvisConfig) {
        prefs.edit()
            .putString("execution_mode", newConfig.executionMode.name)
            .putString("local_model_path", newConfig.localModelPath)
            .putString("lan_server_url", newConfig.lanServerUrl)
            .putString("default_cloud_model", newConfig.defaultCloudModel)
            .putBoolean("wake_word_enabled", newConfig.wakeWordEnabled)
            .putString("wake_word_phrase", newConfig.wakeWordPhrase)
            .putFloat("wake_word_sensitivity", newConfig.wakeWordSensitivity)
            .putFloat("wake_word_threshold", newConfig.wakeWordThreshold)
            .putFloat("wake_word_cooldown_sec", newConfig.wakeWordCooldownSec)
            .putBoolean("background_listening", newConfig.backgroundListening)
            .putInt("command_timeout_sec", newConfig.commandTimeoutSec)
            .putString("tts_voice_provider", newConfig.ttsVoiceProvider)
            .putInt("max_turns", newConfig.maxTurns)
            .putInt("rag_top_k", newConfig.ragTopK)
            .apply()

        _config.value = newConfig
        JarvisLogger.i("ConfigManager", "Configuration updated: mode=${newConfig.executionMode}")
    }
}
