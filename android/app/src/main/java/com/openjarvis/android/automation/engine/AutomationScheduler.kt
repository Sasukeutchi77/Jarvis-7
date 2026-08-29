package com.openjarvis.android.automation.engine

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.openjarvis.android.automation.model.Automation
import com.openjarvis.android.automation.model.RepeatPattern
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.automation.receiver.JarvisAlarmReceiver
import com.openjarvis.android.automation.receiver.JarvisAutomationWorker
import com.openjarvis.android.logging.JarvisLogger
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Intelligent scheduler handling both exact, high-priority alarms (AlarmManager)
 * and deferred battery-efficient periodic tasks (WorkManager).
 */
class AutomationScheduler(
    private val context: Context,
    private val permissionManager: AutomationPermissionManager
) {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    private val workManager = WorkManager.getInstance(context)

    companion object {
        const val ACTION_EXECUTE_AUTOMATION = "com.openjarvis.android.ACTION_EXECUTE_AUTOMATION"
        const val EXTRA_AUTOMATION_ID = "extra_automation_id"
    }

    /**
     * Schedules or reschedules an automation based on its trigger configuration.
     */
    fun scheduleAutomation(automation: Automation): Long? {
        if (!automation.enabled) {
            cancelAutomation(automation.id)
            return null
        }

        when (automation.trigger.type) {
            TriggerType.TIME_TRIGGER -> {
                return scheduleDailyOrPatternAlarm(automation)
            }
            TriggerType.DATE_TRIGGER -> {
                return scheduleExactTimestampAlarm(automation)
            }
            TriggerType.INTERVAL_TRIGGER -> {
                scheduleWorkManagerPeriodic(automation)
                return null
            }
            else -> {
                // Event-based triggers (Battery, Charging, Notification, Voice) are managed dynamically
                return null
            }
        }
    }

    /**
     * Cancels any scheduled alarms or workers for this automation ID.
     */
    fun cancelAutomation(automationId: String) {
        try {
            val intent = Intent(context, JarvisAlarmReceiver::class.java).apply {
                action = ACTION_EXECUTE_AUTOMATION
                putExtra(EXTRA_AUTOMATION_ID, automationId)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                automationId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager?.cancel(pendingIntent)
            pendingIntent.cancel()

            // Cancel periodic work if any
            workManager.cancelUniqueWork("automation_work_$automationId")
            JarvisLogger.d("AutomationScheduler", "Cancelled schedule for automation: $automationId")
        } catch (e: Exception) {
            JarvisLogger.e("AutomationScheduler", "Error cancelling schedule for $automationId: ${e.message}")
        }
    }

    @SuppressLint("ScheduleExactAlarm")
    private fun scheduleDailyOrPatternAlarm(automation: Automation): Long? {
        val timeOfDay = automation.trigger.timeOfDay ?: return null
        val parts = timeOfDay.split(":")
        if (parts.size != 2) return null

        val targetHour = parts[0].toIntOrNull() ?: return null
        val targetMinute = parts[1].toIntOrNull() ?: return null

        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, targetHour)
            set(Calendar.MINUTE, targetMinute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val now = System.currentTimeMillis()
        if (cal.timeInMillis <= now) {
            // Already passed today, push to tomorrow
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }

        // Handle specific repeat patterns
        when (automation.trigger.repeatPattern) {
            RepeatPattern.WEEKDAYS -> {
                while (cal.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || cal.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
            }
            RepeatPattern.WEEKLY -> {
                val targetDayOfWeek = automation.trigger.daysOfWeek.firstOrNull() ?: Calendar.MONDAY
                while (cal.get(Calendar.DAY_OF_WEEK) != targetDayOfWeek) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
            }
            else -> {}
        }

        val triggerTime = cal.timeInMillis
        setExactAlarm(automation.id, triggerTime)
        JarvisLogger.i("AutomationScheduler", "Scheduled [${automation.name}] for $timeOfDay (next: $triggerTime)")
        return triggerTime
    }

    @SuppressLint("ScheduleExactAlarm")
    private fun scheduleExactTimestampAlarm(automation: Automation): Long? {
        val targetTime = automation.trigger.targetTimestamp ?: return null
        val now = System.currentTimeMillis()
        if (targetTime <= now) {
            JarvisLogger.w("AutomationScheduler", "Target timestamp for [${automation.name}] is in the past ($targetTime). Skipping.")
            return null
        }

        setExactAlarm(automation.id, targetTime)
        JarvisLogger.i("AutomationScheduler", "Scheduled exact one-shot alarm for [${automation.name}] at $targetTime")
        return targetTime
    }

    @SuppressLint("ScheduleExactAlarm")
    private fun setExactAlarm(automationId: String, triggerAtMillis: Long) {
        val intent = Intent(context, JarvisAlarmReceiver::class.java).apply {
            action = ACTION_EXECUTE_AUTOMATION
            putExtra(EXTRA_AUTOMATION_ID, automationId)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            automationId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (permissionManager.canScheduleExactAlarms()) {
                alarmManager?.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager?.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }
        } catch (e: Exception) {
            JarvisLogger.e("AutomationScheduler", "Failed to set alarm for $automationId: ${e.message}")
        }
    }

    private fun scheduleWorkManagerPeriodic(automation: Automation) {
        val intervalMinutes = automation.trigger.intervalMinutes ?: 15L
        val constraints = Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .build()

        val workRequest = PeriodicWorkRequestBuilder<JarvisAutomationWorker>(
            intervalMinutes, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setInputData(workDataOf(EXTRA_AUTOMATION_ID to automation.id))
            .build()

        workManager.enqueueUniquePeriodicWork(
            "automation_work_${automation.id}",
            ExistingPeriodicWorkPolicy.UPDATE,
            workRequest
        )
        JarvisLogger.i("AutomationScheduler", "Enqueued periodic WorkManager task for [${automation.name}] (every $intervalMinutes min)")
    }
}
