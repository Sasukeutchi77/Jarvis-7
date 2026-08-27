package com.openjarvis.android.permissions

import android.Manifest
import android.app.NotificationManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.openjarvis.android.services.JarvisDeviceAdminReceiver

enum class PermissionCategory {
    CORE_VOICE_HARDWARE,
    PRIVACY_COMMUNICATIONS,
    SYSTEM_SPECIAL_ACCESS,
    DEVICE_SUPERVISION
}

enum class AndroidPermissionKind {
    RUNTIME_DANGEROUS,
    SPECIAL_SETTINGS_ACCESS,
    SYSTEM_SERVICE_BINDING,
    DEVICE_ADMIN_POLICY
}

data class AndroidPermissionAudit(
    val id: String,
    val name: String,
    val category: PermissionCategory,
    val kind: AndroidPermissionKind,
    val declaredManifest: Boolean,
    val targetApiMin: Int,
    val isGranted: Boolean,
    val whyNeeded: String,
    val officialIntentAction: String?,
    val settingsResolutionPath: String
)

data class PermissionStatus(
    val hasAudioPermission: Boolean = false,
    val hasNotificationPermission: Boolean = false,
    val hasNotificationListenerPermission: Boolean = false,
    val hasOverlayPermission: Boolean = false,
    val hasCameraPermission: Boolean = false,
    val hasCalendarPermission: Boolean = false,
    val hasContactsPermission: Boolean = false,
    val hasSmsPermission: Boolean = false,
    val hasPhonePermission: Boolean = false,
    val hasLocationPermission: Boolean = false,
    val hasBluetoothPermission: Boolean = false,
    val hasStoragePermission: Boolean = false,
    val hasAccessibilityPermission: Boolean = false,
    val hasScreenCapturePermission: Boolean = false,
    val hasDeviceAdminPermission: Boolean = false,
    val hasUsageStatsPermission: Boolean = false
)

object PermissionManager {

    val REQUIRED_CORE_PERMISSIONS = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    val ALL_RUNTIME_PERMISSIONS = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        add(Manifest.permission.CAMERA)
        add(Manifest.permission.READ_CONTACTS)
        add(Manifest.permission.WRITE_CONTACTS)
        add(Manifest.permission.READ_CALENDAR)
        add(Manifest.permission.WRITE_CALENDAR)
        add(Manifest.permission.SEND_SMS)
        add(Manifest.permission.READ_SMS)
        add(Manifest.permission.RECEIVE_SMS)
        add(Manifest.permission.CALL_PHONE)
        add(Manifest.permission.READ_PHONE_STATE)
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.READ_MEDIA_IMAGES)
            add(Manifest.permission.READ_MEDIA_VIDEO)
            add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
            add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_CONNECT)
            add(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            add(Manifest.permission.BLUETOOTH)
            add(Manifest.permission.BLUETOOTH_ADMIN)
        }
    }.toTypedArray()

    fun checkStatus(context: Context): PermissionStatus {
        val hasAudio = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        
        val hasNotification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        val hasNotifListener = isNotificationListenerEnabled(context)

        val hasOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }

        val hasCamera = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasCalendar = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
        val hasContacts = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val hasSms = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED &&
                     ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        
        val hasPhone = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED

        val hasLocation = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        val hasBluetooth = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED
        }

        val hasStorage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager() || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }

        val hasAccessibility = isAccessibilityServiceEnabled(context)
        val hasDeviceAdmin = isDeviceAdminActive(context)

        return PermissionStatus(
            hasAudioPermission = hasAudio,
            hasNotificationPermission = hasNotification,
            hasNotificationListenerPermission = hasNotifListener,
            hasOverlayPermission = hasOverlay,
            hasCameraPermission = hasCamera,
            hasCalendarPermission = hasCalendar,
            hasContactsPermission = hasContacts,
            hasSmsPermission = hasSms,
            hasPhonePermission = hasPhone,
            hasLocationPermission = hasLocation,
            hasBluetoothPermission = hasBluetooth,
            hasStoragePermission = hasStorage,
            hasAccessibilityPermission = hasAccessibility,
            hasScreenCapturePermission = true, // Prompted on-demand via MediaProjection token
            hasDeviceAdminPermission = hasDeviceAdmin,
            hasUsageStatsPermission = hasUsageStatsPermission(context)
        )
    }

    fun auditAllPermissions(context: Context): List<AndroidPermissionAudit> {
        val status = checkStatus(context)
        return listOf(
            AndroidPermissionAudit(
                id = "microphone",
                name = "Microphone & Écoute Vocale",
                category = PermissionCategory.CORE_VOICE_HARDWARE,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasAudioPermission,
                whyNeeded = "Écoute du mot-clé de réveil 'Hey Jarvis', dictée vocale temps réel et commandes conversationnelles.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat / Paramètres Application"
            ),
            AndroidPermissionAudit(
                id = "camera",
                name = "Caméra & Vision Multimodale",
                category = PermissionCategory.CORE_VOICE_HARDWARE,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasCameraPermission,
                whyNeeded = "Analyse OCR de documents, identification d'objets et assistance visuelle instantanée.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat / Paramètres Application"
            ),
            AndroidPermissionAudit(
                id = "notifications",
                name = "Notifications Système (POST_NOTIFICATIONS)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 33,
                isGranted = status.hasNotificationPermission,
                whyNeeded = "Alerte de rappels, suivi des tâches d'agents en arrière-plan et récapitulatifs quotidiens.",
                officialIntentAction = Settings.ACTION_APP_NOTIFICATION_SETTINGS,
                settingsResolutionPath = "Paramètres de notification de l'application"
            ),
            AndroidPermissionAudit(
                id = "notification_listener",
                name = "Notification Listener Service (WhatsApp, SMS, Telegram)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.SYSTEM_SERVICE_BINDING,
                declaredManifest = true,
                targetApiMin = 18,
                isGranted = status.hasNotificationListenerPermission,
                whyNeeded = "Lecture vocale intelligente et préparation des réponses autorisées sur vos messageries.",
                officialIntentAction = Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS,
                settingsResolutionPath = "Accès spécial aux notifications dans Paramètres Système"
            ),
            AndroidPermissionAudit(
                id = "contacts",
                name = "Contacts (READ_CONTACTS & WRITE_CONTACTS)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasContactsPermission,
                whyNeeded = "Résolution du bon destinataire pour les appels téléphoniques et l'envoi de SMS personnalisés.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat"
            ),
            AndroidPermissionAudit(
                id = "calendar",
                name = "Calendrier & Agenda (READ_CALENDAR / WRITE_CALENDAR)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasCalendarPermission,
                whyNeeded = "Consultation de l'agenda, détection des conflits de rendez-vous et planification vocale.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat"
            ),
            AndroidPermissionAudit(
                id = "phone",
                name = "Téléphone & Appels (CALL_PHONE & READ_PHONE_STATE)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasPhonePermission,
                whyNeeded = "Composition immédiate et sécurisée d'appels téléphoniques vocaux sur commande utilisateur.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat"
            ),
            AndroidPermissionAudit(
                id = "sms",
                name = "SMS & Messagerie Directe (SEND_SMS & READ_SMS)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasSmsPermission,
                whyNeeded = "Envoi et confirmation de textos/SMS avec accusé de transmission sécurisé.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat"
            ),
            AndroidPermissionAudit(
                id = "location",
                name = "Localisation GPS (ACCESS_FINE_LOCATION)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasLocationPermission,
                whyNeeded = "Météo locale certifiée temps réel, navigation et recherche de points d'intérêt proches.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime ActivityCompat (Précise / Coarse)"
            ),
            AndroidPermissionAudit(
                id = "bluetooth",
                name = "Bluetooth & Appareils Connectés (BLUETOOTH_CONNECT / SCAN)",
                category = PermissionCategory.CORE_VOICE_HARDWARE,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 31,
                isGranted = status.hasBluetoothPermission,
                whyNeeded = "Détection et contrôle des casques audio, enceintes domotiques et objets connectés Bluetooth.",
                officialIntentAction = Settings.ACTION_BLUETOOTH_SETTINGS,
                settingsResolutionPath = "Paramètres Bluetooth ou demande runtime S+"
            ),
            AndroidPermissionAudit(
                id = "storage",
                name = "Fichiers & Documents (READ_MEDIA_* / STORAGE)",
                category = PermissionCategory.PRIVACY_COMMUNICATIONS,
                kind = AndroidPermissionKind.RUNTIME_DANGEROUS,
                declaredManifest = true,
                targetApiMin = 1,
                isGranted = status.hasStoragePermission,
                whyNeeded = "Indexation et résumé de pièces jointes, images et documents sélectionnés par l'utilisateur.",
                officialIntentAction = null,
                settingsResolutionPath = "Demande runtime PhotoPicker / Media permissions"
            ),
            AndroidPermissionAudit(
                id = "overlay",
                name = "Affichage par-dessus d'autres applications (SYSTEM_ALERT_WINDOW)",
                category = PermissionCategory.SYSTEM_SPECIAL_ACCESS,
                kind = AndroidPermissionKind.SPECIAL_SETTINGS_ACCESS,
                declaredManifest = true,
                targetApiMin = 23,
                isGranted = status.hasOverlayPermission,
                whyNeeded = "Affichage du HUD vocal flottant JARVIS réactif et assistance par-dessus toute interface.",
                officialIntentAction = Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                settingsResolutionPath = "Paramètres > Afficher sur d'autres applications"
            ),
            AndroidPermissionAudit(
                id = "accessibility",
                name = "Service d'Accessibilité (Inspection d'Écran & UI Automation)",
                category = PermissionCategory.SYSTEM_SPECIAL_ACCESS,
                kind = AndroidPermissionKind.SYSTEM_SERVICE_BINDING,
                declaredManifest = true,
                targetApiMin = 14,
                isGranted = status.hasAccessibilityPermission,
                whyNeeded = "Lecture de l'arborescence UI, guidage d'interface et aide à la saisie contextuelle.",
                officialIntentAction = Settings.ACTION_ACCESSIBILITY_SETTINGS,
                settingsResolutionPath = "Paramètres > Accessibilité > JARVIS Core Service"
            ),
            AndroidPermissionAudit(
                id = "screen_capture",
                name = "Capture d'Écran Ponctuelle (MediaProjection)",
                category = PermissionCategory.SYSTEM_SPECIAL_ACCESS,
                kind = AndroidPermissionKind.SPECIAL_SETTINGS_ACCESS,
                declaredManifest = true,
                targetApiMin = 21,
                isGranted = status.hasScreenCapturePermission,
                whyNeeded = "Capture visuelle ponctuelle à la demande avec dialogue de consentement officiel Android.",
                officialIntentAction = null,
                settingsResolutionPath = "Token de projection géré via MediaProjectionManager.createScreenCaptureIntent()"
            ),
            AndroidPermissionAudit(
                id = "assistant",
                name = "Assistant Vocal Android par Défaut (Role & Assist Intent)",
                category = PermissionCategory.SYSTEM_SPECIAL_ACCESS,
                kind = AndroidPermissionKind.SPECIAL_SETTINGS_ACCESS,
                declaredManifest = true,
                targetApiMin = 23,
                isGranted = true, // Intent filter android.intent.action.ASSIST declared
                whyNeeded = "Activation de JARVIS via appui long sur bouton d'alimentation ou geste d'accueil Android.",
                officialIntentAction = Settings.ACTION_VOICE_INPUT_SETTINGS,
                settingsResolutionPath = "Paramètres > Applications par défaut > Application d'assistance"
            ),
            AndroidPermissionAudit(
                id = "device_admin",
                name = "Super Administrateur de l'Appareil (DevicePolicyManager)",
                category = PermissionCategory.DEVICE_SUPERVISION,
                kind = AndroidPermissionKind.DEVICE_ADMIN_POLICY,
                declaredManifest = true,
                targetApiMin = 8,
                isGranted = status.hasDeviceAdminPermission,
                whyNeeded = "Verrouillage de sécurité immédiat, application des mises à jour OTA et réinitialisation autorisée.",
                officialIntentAction = DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN,
                settingsResolutionPath = "Paramètres de sécurité > Administrateurs de l'appareil"
            )
        )
    }

    private fun isNotificationListenerEnabled(context: Context): Boolean {
        val packageName = context.packageName
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(packageName)
    }

    private fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val expectedComponentName = "${context.packageName}/com.openjarvis.android.services.JarvisAccessibilityService"
        val enabledServices = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        return enabledServices != null && enabledServices.contains(expectedComponentName)
    }

    private fun isDeviceAdminActive(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager ?: return false
        val adminComponent = ComponentName(context, JarvisDeviceAdminReceiver::class.java)
        return dpm.isAdminActive(adminComponent)
    }

    private fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? android.app.AppOpsManager ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        } else {
            appOps.checkOpNoThrow(
                android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        }
        return mode == android.app.AppOpsManager.MODE_ALLOWED
    }
}

