package com.openjarvis.android

import android.app.Application
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.core.bridge.OpenJarvisCoreBridge
import com.openjarvis.android.hologram.HologramConfig
import com.openjarvis.android.hologram.HologramController
import com.openjarvis.android.hologram.HologramQuality
import com.openjarvis.android.hologram.HologramThemeColor
import com.openjarvis.android.lifecycle.AppLifecycleManager
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.storage.database.JarvisDatabase
import com.openjarvis.android.storage.memory.PersonalMemoryManager
import com.openjarvis.android.voice.VoiceEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class JarvisApplication : Application() {

    lateinit var secureVault: SecureVault
        private set

    lateinit var configManager: ConfigManager
        private set

    lateinit var database: JarvisDatabase
        private set

    lateinit var personalMemoryManager: PersonalMemoryManager
        private set

    lateinit var lifecycleManager: AppLifecycleManager
        private set

    lateinit var coreBridge: OpenJarvisCoreBridge
        private set

    lateinit var voiceEngine: VoiceEngine
        private set

    lateinit var hologramController: HologramController
        private set

    val deviceController get() = coreBridge.deviceController
    val communicationController get() = coreBridge.communicationController
    val memoryCore get() = coreBridge.memoryCore

    override fun onCreate() {
        super.onCreate()
        instance = this

        setupUncaughtExceptionHandler()

        JarvisLogger.i("Application", "Starting OpenJarvis Android Application...")

        secureVault = SecureVault(this)
        configManager = ConfigManager(this)
        database = JarvisDatabase.getInstance(this)
        personalMemoryManager = PersonalMemoryManager(this, database, secureVault, configManager)

        lifecycleManager = AppLifecycleManager(this)
        lifecycleManager.initialize()

        coreBridge = OpenJarvisCoreBridge(this, configManager, secureVault, database, personalMemoryManager)
        coreBridge.initialize()

        voiceEngine = VoiceEngine(this, configManager, secureVault, coreBridge)
        voiceEngine.initialize()

        // Initialize Holographic HUD Controller
        val appConfig = configManager.config.value
        val themeColor = try {
            HologramThemeColor.valueOf(appConfig.hologramTheme)
        } catch (e: Exception) {
            HologramThemeColor.CYBER_CYAN
        }
        val quality = try {
            HologramQuality.valueOf(appConfig.hologramQuality)
        } catch (e: Exception) {
            HologramQuality.HIGH
        }

        hologramController = HologramController(this, configManager)
        hologramController.updateConfig(
            HologramConfig(
                enabled = appConfig.hologramEnabled,
                overlayEnabled = appConfig.overlayEnabled,
                themeColor = themeColor,
                quality = quality,
                autoHide = appConfig.hologramAutoHide,
                autoHideDelaySec = appConfig.hologramAutoHideDelaySec,
                hapticFeedbackEnabled = appConfig.hapticFeedbackEnabled,
                activationSoundEnabled = appConfig.activationSoundEnabled
            )
        )
        hologramController.bindToVoiceEngine(voiceEngine)

        // Seed initial memories asynchronously
        CoroutineScope(Dispatchers.IO).launch {
            personalMemoryManager.seedDefaultMemoriesIfEmpty()
        }

        JarvisLogger.i("Application", "OpenJarvis Android Subsystems, Voice & Hologram HUD Engine initialized.")
    }

    private fun setupUncaughtExceptionHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            JarvisLogger.e("CrashHandler", "Uncaught exception on thread ${thread.name}", throwable)
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    companion object {
        lateinit var instance: JarvisApplication
            private set
    }
}
