package com.openjarvis.android.communication.permissions

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Diagnostic record representing permission status for Communication features.
 */
data class CommunicationPermissionStatus(
    val permission: String,
    val name: String,
    val description: String,
    val isGranted: Boolean,
    val isCritical: Boolean = false,
    val openSettingsAction: String? = null
)

/**
 * Manager for checking and navigating Android permissions required by JARVIS Communication Center.
 */
class CommunicationPermissionManager(private val context: Context) {

    fun hasContactsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    }

    fun hasReadSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    fun hasSendSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    }

    fun hasCallPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
    }

    fun hasNotificationListenerPermission(): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(context.packageName)
    }

    fun getAllPermissionsStatus(): List<CommunicationPermissionStatus> {
        return listOf(
            CommunicationPermissionStatus(
                permission = "NOTIFICATION_LISTENER",
                name = "Accès aux Notifications",
                description = "Permet à JARVIS de lire les messages WhatsApp, Telegram, SMS et de répondre",
                isGranted = hasNotificationListenerPermission(),
                isCritical = true,
                openSettingsAction = Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            ),
            CommunicationPermissionStatus(
                permission = Manifest.permission.READ_CONTACTS,
                name = "Lecture du Répertoire",
                description = "Permet à JARVIS de trouver les correspondants par leur nom",
                isGranted = hasContactsPermission(),
                isCritical = true
            ),
            CommunicationPermissionStatus(
                permission = Manifest.permission.READ_SMS,
                name = "Lecture des SMS",
                description = "Permet de lire les SMS récents et de rechercher des messages",
                isGranted = hasReadSmsPermission(),
                isCritical = false
            ),
            CommunicationPermissionStatus(
                permission = Manifest.permission.SEND_SMS,
                name = "Envoi direct de SMS",
                description = "Permet d'envoyer des SMS automatiquement après votre confirmation vocale",
                isGranted = hasSendSmsPermission(),
                isCritical = false
            ),
            CommunicationPermissionStatus(
                permission = Manifest.permission.CALL_PHONE,
                name = "Appels Directs",
                description = "Permet de lancer des appels téléphoniques après confirmation",
                isGranted = hasCallPermission(),
                isCritical = false
            )
        )
    }

    fun openNotificationListenerSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            openAppSettings()
        }
    }

    fun openAppSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Fallback
        }
    }
}
