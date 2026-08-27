package com.openjarvis.android.config

enum class ExecutionMode {
    LOCAL_ONLY,     // Modèles GGUF légers sur l'appareil
    HYBRID,         // Arbitrage intelligent (Local pour petites requêtes, Cloud pour le reste)
    CLOUD_ONLY,     // Modèles Cloud distants (Gemini, Claude, GPT)
    LAN_ONLY        // Serveur Ollama / vLLM local sur le réseau Wi-Fi
}

data class JarvisConfig(
    val executionMode: ExecutionMode = ExecutionMode.HYBRID,
    val localModelPath: String = "",
    val lanServerUrl: String = "http://192.168.1.100:11434",
    val defaultCloudModel: String = "gemini-2.5-flash",
    val wakeWordEnabled: Boolean = true,
    val wakeWordPhrase: String = "Hey JARVIS",
    val wakeWordSensitivity: Float = 0.5f,
    val wakeWordThreshold: Float = 0.75f,
    val wakeWordCooldownSec: Float = 2.0f,
    val backgroundListening: Boolean = true,
    val commandTimeoutSec: Int = 7,
    val ttsVoiceProvider: String = "android_native", // "android_native", "deepgram", or "cartesia"
    val maxTurns: Int = 10,
    val ragTopK: Int = 5,
    val lowPowerModeThreshold: Int = 20
)
