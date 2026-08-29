package com.openjarvis.android.automation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver monitoring power connection/disconnection and battery events.
 */
class JarvisBatteryReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        JarvisLogger.d("JarvisBatteryReceiver", "Battery broadcast received: $action")

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val app = JarvisApplication.instance
                when (action) {
                    Intent.ACTION_POWER_CONNECTED -> {
                        app.automationManager.handleChargingChanged(isCharging = true)
                    }
                    Intent.ACTION_POWER_DISCONNECTED -> {
                        app.automationManager.handleChargingChanged(isCharging = false)
                    }
                    Intent.ACTION_BATTERY_LOW -> {
                        app.automationManager.handleBatteryStateChanged(isLow = true)
                    }
                    Intent.ACTION_BATTERY_OKAY -> {
                        app.automationManager.handleBatteryStateChanged(isLow = false)
                    }
                }
            } catch (e: Exception) {
                JarvisLogger.e("JarvisBatteryReceiver", "Error handling battery event: ${e.message}")
            } finally {
                pendingResult.finish()
            }
        }
    }
}
