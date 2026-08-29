package com.openjarvis.android.automation.engine

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.openjarvis.android.automation.model.ActionType
import com.openjarvis.android.automation.model.Automation
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.services.JarvisNotificationListenerService

/**
 * Validates Android runtime, hardware, and special system permissions before running automations.
 */
class AutomationPermissionManager(private val context: Context) {

    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }

    fun canScheduleExactAlarms(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            return alarmManager?.canScheduleExactAlarms() == true
        }
        return true
    }

    fun isNotificationAccessGranted(): Boolean {
        return JarvisNotificationListenerService.isNotificationAccessGranted(context)
    }

    fun canExecuteAutomation(automation: Automation): Pair<Boolean, String?> {
        // Check Trigger Permissions
        when (automation.trigger.type) {
            TriggerType.TIME_TRIGGER, TriggerType.DATE_TRIGGER -> {
                if (!canScheduleExactAlarms()) {
                    // Allowed, but inexact / workmanager fallback may apply
                }
            }
            TriggerType.NOTIFICATION_TRIGGER -> {
                if (!isNotificationAccessGranted()) {
                    return Pair(false, "L'accès aux notifications Android n'est pas activé pour JARVIS.")
                }
            }
            else -> {}
        }

        // Check Actions Permissions
        for (action in automation.actions) {
            when (action.type) {
                ActionType.SHOW_NOTIFICATION -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        if (!hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                            return Pair(false, "La permission de poster des notifications n'est pas accordée.")
                        }
                    }
                }
                ActionType.SEND_SMS -> {
                    if (!hasPermission(Manifest.permission.SEND_SMS)) {
                        return Pair(false, "La permission d'envoi de SMS n'est pas accordée.")
                    }
                }
                ActionType.FLASHLIGHT -> {
                    if (!hasPermission(Manifest.permission.CAMERA)) {
                        return Pair(false, "La permission Caméra/Flash n'est pas accordée.")
                    }
                }
                ActionType.REPLY_NOTIFICATION -> {
                    if (!isNotificationAccessGranted()) {
                        return Pair(false, "L'accès aux notifications est requis pour envoyer une réponse.")
                    }
                }
                else -> {}
            }
        }

        return Pair(true, null)
    }
}
