package com.openjarvis.android.device.navigation

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.services.JarvisAccessibilityService
import com.openjarvis.android.services.JarvisDeviceAdminReceiver

/**
 * Controller for OS navigation, global accessibility shortcuts, device locking, and system settings pages.
 */
class NavigationController(private val context: Context) {

    /**
     * Go to Android Home Screen.
     */
    fun goHome(): DeviceActionResult {
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            JarvisLogger.i("NavigationController", "Navigated to Home screen")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Retour à l'écran d'accueil.",
                actionType = DeviceActionType.NAVIGATION
            )
        } catch (e: Exception) {
            JarvisLogger.e("NavigationController", "Failed to go home", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible de retourner à l'accueil : ${e.message}",
                actionType = DeviceActionType.NAVIGATION,
                error = e.message
            )
        }
    }

    /**
     * Open Recent Applications switcher (via AccessibilityService or Fallback).
     */
    fun openRecentApps(): DeviceActionResult {
        val accessService = JarvisAccessibilityService.instance
        if (accessService != null) {
            val success = accessService.performGlobalSystemAction(AccessibilityService.GLOBAL_ACTION_RECENTS)
            if (success) {
                return DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = "J'affiche les applications récentes.",
                    actionType = DeviceActionType.NAVIGATION
                )
            }
        }

        return DeviceActionResult(
            status = ActionResultStatus.PERMISSION_REQUIRED,
            spokenMessage = "Pour afficher les applications récentes, le service d'accessibilité JARVIS doit être activé dans vos paramètres.",
            actionType = DeviceActionType.NAVIGATION,
            fallbackIntentAction = Settings.ACTION_ACCESSIBILITY_SETTINGS,
            error = "Accessibility service inactive"
        )
    }

    /**
     * Lock the phone screen immediately via DeviceAdmin or Accessibility.
     */
    fun lockDevice(): DeviceActionResult {
        // 1. Try Device Admin
        if (JarvisDeviceAdminReceiver.isDeviceAdminActive(context)) {
            val locked = JarvisDeviceAdminReceiver.lockNow(context)
            if (locked) {
                return DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = "Téléphone verrouillé.",
                    actionType = DeviceActionType.LOCK_DEVICE
                )
            }
        }

        // 2. Try Accessibility Service (GLOBAL_ACTION_LOCK_SCREEN supported on API 28+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val accessService = JarvisAccessibilityService.instance
            if (accessService != null) {
                val success = accessService.performGlobalSystemAction(AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN)
                if (success) {
                    return DeviceActionResult(
                        status = ActionResultStatus.SUCCESS,
                        spokenMessage = "Téléphone verrouillé.",
                        actionType = DeviceActionType.LOCK_DEVICE
                    )
                }
            }
        }

        // 3. Inform user about missing official mechanism
        return DeviceActionResult(
            status = ActionResultStatus.PERMISSION_REQUIRED,
            spokenMessage = "Le verrouillage nécessite l'activation de l'administrateur d'appareil JARVIS ou du service d'accessibilité.",
            actionType = DeviceActionType.LOCK_DEVICE,
            fallbackIntentAction = Settings.ACTION_SECURITY_SETTINGS,
            error = "Admin / Accessibility missing for screen lock"
        )
    }

    /**
     * Open specific Android System Settings page.
     */
    fun openSettingsPage(target: String): DeviceActionResult {
        val (intentAction, label) = when (target.lowercase().trim()) {
            "wifi", "wi-fi", "internet", "connexion" -> Settings.ACTION_WIFI_SETTINGS to "Wi-Fi"
            "bluetooth", "bt" -> Settings.ACTION_BLUETOOTH_SETTINGS to "Bluetooth"
            "display", "affichage", "écran", "ecran", "luminosité" -> Settings.ACTION_DISPLAY_SETTINGS to "Affichage"
            "sound", "son", "audio", "volume", "sonnerie" -> Settings.ACTION_SOUND_SETTINGS to "Son et vibrations"
            "battery", "batterie", "energie", "énergie", "alimentation" -> (
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) Settings.ACTION_BATTERY_SAVER_SETTINGS else Settings.ACTION_SETTINGS
            ) to "Batterie"
            "apps", "applications", "applis" -> Settings.ACTION_APPLICATION_SETTINGS to "Applications"
            "location", "localisation", "gps", "position" -> Settings.ACTION_LOCATION_SOURCE_SETTINGS to "Localisation"
            "notifications", "notifs" -> (
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Settings.ACTION_ALL_APPS_NOTIFICATION_SETTINGS else Settings.ACTION_SETTINGS
            ) to "Notifications"
            "accessibility", "accessibilite", "accessibilité" -> Settings.ACTION_ACCESSIBILITY_SETTINGS to "Accessibilité"
            "security", "securite", "sécurité" -> Settings.ACTION_SECURITY_SETTINGS to "Sécurité"
            "date", "heure", "horloge" -> Settings.ACTION_DATE_SETTINGS to "Date et heure"
            else -> Settings.ACTION_SETTINGS to "Paramètres généraux"
        }

        return try {
            val intent = Intent(intentAction).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            JarvisLogger.i("NavigationController", "Opened settings page: $label ($intentAction)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ouvre les paramètres $label.",
                actionType = DeviceActionType.SETTINGS,
                details = mapOf("target" to target, "action" to intentAction)
            )
        } catch (e: Exception) {
            JarvisLogger.e("NavigationController", "Error opening settings $target", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ouvrir les paramètres $label : ${e.message}",
                actionType = DeviceActionType.SETTINGS,
                error = e.message
            )
        }
    }

    /**
     * Handle Bluetooth toggle or settings navigation.
     */
    fun handleBluetoothCommand(enable: Boolean? = null): DeviceActionResult {
        openSettingsPage("bluetooth")
        val spoken = if (enable != null) {
            "Sur cette version d'Android, la modification du Bluetooth s'effectue via le panneau système. J'ai ouvert les paramètres Bluetooth."
        } else {
            "J'ouvre les paramètres Bluetooth."
        }
        return DeviceActionResult(
            status = ActionResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = DeviceActionType.BLUETOOTH,
            fallbackIntentAction = Settings.ACTION_BLUETOOTH_SETTINGS
        )
    }

    /**
     * Handle Wi-Fi toggle or settings navigation.
     */
    fun handleWifiCommand(enable: Boolean? = null): DeviceActionResult {
        openSettingsPage("wifi")
        val spoken = if (enable != null) {
            "Sur cette version d'Android, la modification du Wi-Fi s'effectue via le panneau de connexion système. J'ai ouvert les paramètres Wi-Fi."
        } else {
            "J'ouvre les paramètres Wi-Fi."
        }
        return DeviceActionResult(
            status = ActionResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = DeviceActionType.WIFI,
            fallbackIntentAction = Settings.ACTION_WIFI_SETTINGS
        )
    }
}
