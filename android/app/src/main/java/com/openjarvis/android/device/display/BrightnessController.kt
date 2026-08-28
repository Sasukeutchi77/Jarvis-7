package com.openjarvis.android.device.display

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import kotlin.math.roundToInt

/**
 * Controller for device screen brightness adjustments and display settings navigation.
 */
class BrightnessController(private val context: Context) {

    fun getCurrentBrightnessPercentage(): Int {
        return try {
            val raw = Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS)
            ((raw.toFloat() / 255f) * 100f).roundToInt().coerceIn(0, 100)
        } catch (e: Exception) {
            50
        }
    }

    /**
     * Set exact brightness percentage (0 - 100).
     */
    fun setBrightnessPercentage(percentage: Int): DeviceActionResult {
        val clamped = percentage.coerceIn(0, 100)
        val rawValue = ((clamped / 100f) * 255f).roundToInt().coerceIn(0, 255)

        if (!Settings.System.canWrite(context)) {
            JarvisLogger.w("BrightnessController", "WRITE_SETTINGS permission missing. Opening display settings fallback.")
            openDisplaySettings()
            return DeviceActionResult(
                status = ActionResultStatus.PERMISSION_REQUIRED,
                spokenMessage = "Je ne peux pas modifier directement la luminosité sans permission d'écriture des paramètres système. J'ouvre les paramètres d'affichage pour vous.",
                actionType = DeviceActionType.BRIGHTNESS,
                requiredPermission = "android.permission.WRITE_SETTINGS",
                fallbackIntentAction = Settings.ACTION_DISPLAY_SETTINGS,
                details = mapOf("targetPercentage" to clamped)
            )
        }

        return try {
            // Set manual brightness mode first
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            // Apply value
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
                rawValue
            )
            JarvisLogger.i("BrightnessController", "Successfully set screen brightness to $clamped% (raw $rawValue/255)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "La luminosité de l'écran est réglée à $clamped %.",
                actionType = DeviceActionType.BRIGHTNESS,
                details = mapOf("percentage" to clamped, "raw" to rawValue)
            )
        } catch (e: Exception) {
            JarvisLogger.e("BrightnessController", "Failed to write screen brightness", e)
            openDisplaySettings()
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ajuster la luminosité. J'ai ouvert les paramètres d'affichage.",
                actionType = DeviceActionType.BRIGHTNESS,
                error = e.message
            )
        }
    }

    fun increaseBrightness(deltaPercent: Int = 20): DeviceActionResult {
        val current = getCurrentBrightnessPercentage()
        val target = (current + deltaPercent).coerceAtMost(100)
        return setBrightnessPercentage(target)
    }

    fun decreaseBrightness(deltaPercent: Int = 20): DeviceActionResult {
        val current = getCurrentBrightnessPercentage()
        val target = (current - deltaPercent).coerceAtLeast(5)
        return setBrightnessPercentage(target)
    }

    private fun openDisplaySettings() {
        try {
            val intent = Intent(Settings.ACTION_DISPLAY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            JarvisLogger.e("BrightnessController", "Error opening display settings", e)
        }
    }

    fun openWriteSettingsPermissionPage() {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            JarvisLogger.e("BrightnessController", "Error opening write settings page", e)
        }
    }
}
