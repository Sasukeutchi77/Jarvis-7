package com.openjarvis.android.memory.policy

import android.content.Context
import android.content.SharedPreferences
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class MemoryConfig(
    val memoryEnabled: Boolean = true,
    val privateMemoryMode: Boolean = false,
    val autoExtractMemory: Boolean = false,
    val shortTermTimeoutMinutes: Int = 5,
    val conversationSessionTimeoutMinutes: Int = 20,
    val maxMemoriesInjectedInPrompt: Int = 3,
    val relevanceScoreThreshold: Float = 0.35f
)

/**
 * Manages persistent preferences for the JARVIS Memory Core.
 */
class MemorySettings(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("openjarvis_memory_config", Context.MODE_PRIVATE)

    private val _config = MutableStateFlow(loadConfig())
    val config: StateFlow<MemoryConfig> = _config.asStateFlow()

    private fun loadConfig(): MemoryConfig {
        return MemoryConfig(
            memoryEnabled = prefs.getBoolean("memory_enabled", true),
            privateMemoryMode = prefs.getBoolean("private_memory_mode", false),
            autoExtractMemory = prefs.getBoolean("auto_extract_memory", false),
            shortTermTimeoutMinutes = prefs.getInt("short_term_timeout_min", 5),
            conversationSessionTimeoutMinutes = prefs.getInt("conv_session_timeout_min", 20),
            maxMemoriesInjectedInPrompt = prefs.getInt("max_memories_injected", 3),
            relevanceScoreThreshold = prefs.getFloat("relevance_threshold", 0.35f)
        )
    }

    fun updateConfig(newConfig: MemoryConfig) {
        prefs.edit()
            .putBoolean("memory_enabled", newConfig.memoryEnabled)
            .putBoolean("private_memory_mode", newConfig.privateMemoryMode)
            .putBoolean("auto_extract_memory", newConfig.autoExtractMemory)
            .putInt("short_term_timeout_min", newConfig.shortTermTimeoutMinutes)
            .putInt("conv_session_timeout_min", newConfig.conversationSessionTimeoutMinutes)
            .putInt("max_memories_injected", newConfig.maxMemoriesInjectedInPrompt)
            .putFloat("relevance_threshold", newConfig.relevanceScoreThreshold)
            .apply()

        _config.value = newConfig
        JarvisLogger.i("MemorySettings", "Memory settings updated: enabled=${newConfig.memoryEnabled}, privateMode=${newConfig.privateMemoryMode}")
    }

    fun setMemoryEnabled(enabled: Boolean) {
        updateConfig(_config.value.copy(memoryEnabled = enabled))
    }

    fun setPrivateMemoryMode(enabled: Boolean) {
        updateConfig(_config.value.copy(privateMemoryMode = enabled))
    }
}

/**
 * Business rules and policy enforcement for Memory storage and retrieval.
 */
class MemoryPolicy(private val settings: MemorySettings) {

    fun isMemoryAccessible(): Boolean {
        return settings.config.value.memoryEnabled
    }

    fun canStoreLongTermMemory(): Boolean {
        val cfg = settings.config.value
        return cfg.memoryEnabled && !cfg.privateMemoryMode
    }

    fun shouldAutoExtract(): Boolean {
        val cfg = settings.config.value
        return cfg.memoryEnabled && !cfg.privateMemoryMode && cfg.autoExtractMemory
    }

    fun getShortTermTimeoutMs(): Long {
        return settings.config.value.shortTermTimeoutMinutes * 60 * 1000L
    }

    fun getConversationTimeoutMs(): Long {
        return settings.config.value.conversationSessionTimeoutMinutes * 60 * 1000L
    }

    fun getMaxContextItems(): Int {
        return settings.config.value.maxMemoriesInjectedInPrompt
    }

    fun getRelevanceThreshold(): Float {
        return settings.config.value.relevanceScoreThreshold
    }
}
