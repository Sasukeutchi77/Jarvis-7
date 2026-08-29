package com.openjarvis.android.automation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.automation.engine.AutomationScheduler
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver triggered by AlarmManager for exact time/date automations.
 */
class JarvisAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val automationId = intent.getStringExtra(AutomationScheduler.EXTRA_AUTOMATION_ID)
        if (automationId.isNullOrBlank()) {
            JarvisLogger.w("JarvisAlarmReceiver", "Received alarm intent without automationId.")
            return
        }

        JarvisLogger.i("JarvisAlarmReceiver", "Alarm fired for automation ID: $automationId")
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val app = JarvisApplication.instance
                app.automationManager.executeAutomationById(
                    automationId = automationId,
                    triggerType = TriggerType.TIME_TRIGGER
                )
            } catch (e: Exception) {
                JarvisLogger.e("JarvisAlarmReceiver", "Error executing alarm automation: ${e.message}")
            } finally {
                pendingResult.finish()
            }
        }
    }
}
