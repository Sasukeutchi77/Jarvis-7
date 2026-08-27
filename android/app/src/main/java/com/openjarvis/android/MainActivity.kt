package com.openjarvis.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.permissions.PermissionManager
import com.openjarvis.android.services.VoiceAssistantForegroundService
import com.openjarvis.android.ui.screens.main.MainScreen
import com.openjarvis.android.ui.theme.OpenJarvisTheme

class MainActivity : ComponentActivity() {

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val audioGranted = permissions[android.Manifest.permission.RECORD_AUDIO] ?: false
        JarvisLogger.i("MainActivity", "Core permissions updated: audioGranted=$audioGranted")
        if (audioGranted && JarvisApplication.instance.configManager.config.value.wakeWordEnabled) {
            VoiceAssistantForegroundService.start(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        JarvisLogger.i("MainActivity", "MainActivity initialized.")

        // Request core permissions on startup
        permissionLauncher.launch(PermissionManager.REQUIRED_CORE_PERMISSIONS)

        setContent {
            OpenJarvisTheme {
                MainScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (PermissionManager.checkStatus(this).hasAudioPermission &&
            JarvisApplication.instance.configManager.config.value.wakeWordEnabled
        ) {
            VoiceAssistantForegroundService.start(this)
        }
    }
}
