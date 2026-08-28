package com.openjarvis.android.device.security

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.openjarvis.android.device.model.CapabilityState
import com.openjarvis.android.device.model.DeviceCapabilityInfo
import com.openjarvis.android.services.JarvisAccessibilityService
import com.openjarvis.android.services.JarvisDeviceAdminReceiver
import com.openjarvis.android.services.JarvisNotificationListenerService

/**
 * Validates real Android permissions, capabilities and system roles before any device operation.
 * Adheres strictly to official Android security policies.
 */
class JarvisPermissionManager(private val context: Context) {

    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }

    fun hasRecordAudioPermission(): Boolean = hasPermission(Manifest.permission.RECORD_AUDIO)

    fun hasCameraPermission(): Boolean = hasPermission(Manifest.permission.CAMERA)

    fun hasContactsPermission(): Boolean = hasPermission(Manifest.permission.READ_CONTACTS)

    fun hasCallPhonePermission(): Boolean = hasPermission(Manifest.permission.CALL_PHONE)

    fun hasSendSmsPermission(): Boolean = hasPermission(Manifest.permission.SEND_SMS)

    fun hasBluetoothPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            hasPermission(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            hasPermission(Manifest.permission.BLUETOOTH)
        }
    }

    fun canWriteSystemSettings(): Boolean {
        return Settings.System.canWrite(context)
    }

    fun canDrawOverlays(): Boolean {
        return Settings.canDrawOverlays(context)
    }

    fun isAccessibilityActive(): Boolean {
        return JarvisAccessibilityService.instance != null
    }

    fun isNotificationListenerActive(): Boolean {
        return JarvisNotificationListenerService.isServiceConnected()
    }

    fun isDeviceAdminActive(): Boolean {
        return JarvisDeviceAdminReceiver.isDeviceAdminActive(context)
    }

    fun isIgnoringBatteryOptimizations(): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    /**
     * Inspect all core hardware & system capabilities for real diagnostics.
     */
    fun auditCapabilities(): List<DeviceCapabilityInfo> {
        val pm = context.packageManager
        val hasFlash = pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)
        val hasCamera = pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
        val hasTelephony = pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
        val hasBluetooth = pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH)
        val hasWifi = pm.hasSystemFeature(PackageManager.FEATURE_WIFI)

        return listOf(
            DeviceCapabilityInfo(
                key = "overlay",
                name = "Affichage Flottant Overlay",
                description = "HUD holographique interactif au-dessus des applications.",
                state = if (canDrawOverlays()) CapabilityState.AVAILABLE else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 23,
                requiredPermission = Manifest.permission.SYSTEM_ALERT_WINDOW,
                settingsAction = Settings.ACTION_MANAGE_OVERLAY_PERMISSION
            ),
            DeviceCapabilityInfo(
                key = "microphone",
                name = "Microphone & Écoute",
                description = "Reconnaissance vocale et détection de Hey JARVIS.",
                state = if (hasRecordAudioPermission()) CapabilityState.AVAILABLE else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.RECORD_AUDIO,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "flashlight",
                name = "Lampe Torche / Flash",
                description = "Activation physique de la torche LED.",
                state = if (!hasFlash) CapabilityState.HARDWARE_UNAVAILABLE else CapabilityState.AVAILABLE,
                minApiLevel = 23,
                requiredPermission = Manifest.permission.FLASHLIGHT,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "camera",
                name = "Capteur Caméra",
                description = "Lancement de l'appareil photo et capture visuelle.",
                state = if (!hasCamera) CapabilityState.HARDWARE_UNAVAILABLE 
                        else if (hasCameraPermission()) CapabilityState.AVAILABLE 
                        else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.CAMERA,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "contacts",
                name = "Répertoire Contacts",
                description = "Résolution vocale de contacts pour appels et messages.",
                state = if (hasContactsPermission()) CapabilityState.AVAILABLE else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.READ_CONTACTS,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "phone",
                name = "Appels Téléphoniques",
                description = "Composition et initialisation d'appels voix.",
                state = if (!hasTelephony) CapabilityState.HARDWARE_UNAVAILABLE
                        else if (hasCallPhonePermission()) CapabilityState.AVAILABLE
                        else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.CALL_PHONE,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "sms",
                name = "Messagerie SMS",
                description = "Envoi et rédaction assistée de SMS.",
                state = if (!hasTelephony) CapabilityState.HARDWARE_UNAVAILABLE
                        else if (hasSendSmsPermission()) CapabilityState.AVAILABLE
                        else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.SEND_SMS,
                settingsAction = null
            ),
            DeviceCapabilityInfo(
                key = "accessibility",
                name = "Service d'Accessibilité",
                description = "Actions système globales (Accueil, Récents) et contexte d'écran.",
                state = if (isAccessibilityActive()) CapabilityState.AVAILABLE else CapabilityState.SYSTEM_RESTRICTED,
                minApiLevel = 14,
                requiredPermission = Manifest.permission.BIND_ACCESSIBILITY_SERVICE,
                settingsAction = Settings.ACTION_ACCESSIBILITY_SETTINGS
            ),
            DeviceCapabilityInfo(
                key = "notifications",
                name = "Écoute des Notifications",
                description = "NotificationListenerService pour lecture des messages WhatsApp / SMS.",
                state = if (isNotificationListenerActive()) CapabilityState.AVAILABLE else CapabilityState.SYSTEM_RESTRICTED,
                minApiLevel = 18,
                requiredPermission = Manifest.permission.BIND_NOTIFICATION_LISTENER_SERVICE,
                settingsAction = Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            ),
            DeviceCapabilityInfo(
                key = "bluetooth",
                name = "Contrôle Bluetooth",
                description = "État et configuration des périphériques Bluetooth.",
                state = if (!hasBluetooth) CapabilityState.HARDWARE_UNAVAILABLE
                        else if (hasBluetoothPermission()) CapabilityState.AVAILABLE
                        else CapabilityState.PERMISSION_MISSING,
                minApiLevel = 1,
                requiredPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Manifest.permission.BLUETOOTH_CONNECT else Manifest.permission.BLUETOOTH,
                settingsAction = Settings.ACTION_BLUETOOTH_SETTINGS
            ),
            DeviceCapabilityInfo(
                key = "wifi",
                name = "Contrôle Wi-Fi",
                description = "État et ouverture des réglages Wi-Fi.",
                state = if (!hasWifi) CapabilityState.HARDWARE_UNAVAILABLE else CapabilityState.AVAILABLE,
                minApiLevel = 1,
                requiredPermission = Manifest.permission.ACCESS_WIFI_STATE,
                settingsAction = Settings.ACTION_WIFI_SETTINGS
            ),
            DeviceCapabilityInfo(
                key = "brightness_write",
                name = "Modification Luminosité",
                description = "Écriture directe du paramètre de luminosité système.",
                state = if (canWriteSystemSettings()) CapabilityState.AVAILABLE else CapabilityState.SYSTEM_RESTRICTED,
                minApiLevel = 23,
                requiredPermission = Manifest.permission.WRITE_SETTINGS,
                settingsAction = Settings.ACTION_MANAGE_WRITE_SETTINGS
            ),
            DeviceCapabilityInfo(
                key = "device_admin",
                name = "Administration Appareil",
                description = "Verrouillage immédiat et politique de sécurité avancée.",
                state = if (isDeviceAdminActive()) CapabilityState.AVAILABLE else CapabilityState.SYSTEM_RESTRICTED,
                minApiLevel = 8,
                requiredPermission = Manifest.permission.BIND_DEVICE_ADMIN,
                settingsAction = Settings.ACTION_SECURITY_SETTINGS
            )
        )
    }
}
