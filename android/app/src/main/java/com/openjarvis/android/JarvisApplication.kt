package com.openjarvis.android

import android.app.Application
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.core.bridge.OpenJarvisCoreBridge
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

        // Seed initial memories asynchronously
        CoroutineScope(Dispatchers.IO).launch {
            personalMemoryManager.seedDefaultMemoriesIfEmpty()
        }

        JarvisLogger.i("Application", "OpenJarvis Android Subsystems & Personal Memory Engine initialized.")
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
