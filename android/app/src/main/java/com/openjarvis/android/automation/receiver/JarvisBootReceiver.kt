package com.openjarvis.android.automation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Reschedules all enabled alarms and background routines when the device boots or app updates.
 */
class JarvisBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        JarvisLogger.i("JarvisBootReceiver", "Device boot or package update detected (action: $action). Re-arming automations...")

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val app = JarvisApplication.instance
                app.automationManager.rescheduleAllActiveAutomations()
                JarvisLogger.i("JarvisBootReceiver", "All active automations successfully rescheduled after boot.")
            } catch (e: Exception) {
                JarvisLogger.e("JarvisBootReceiver", "Failed to reschedule automations on boot: ${e.message}")
            } finally {
                pendingResult.finish()
            }
        }
    }
}
