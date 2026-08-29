package com.openjarvis.android.automation.receiver

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.automation.engine.AutomationScheduler
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.logging.JarvisLogger

/**
 * CoroutineWorker executing periodic or deferred automation jobs.
 */
class JarvisAutomationWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val automationId = inputData.getString(AutomationScheduler.EXTRA_AUTOMATION_ID)
        if (automationId.isNullOrBlank()) {
            JarvisLogger.w("AutomationWorker", "No automationId provided in work data.")
            return Result.failure()
        }

        JarvisLogger.i("AutomationWorker", "Executing periodic worker for automation ID: $automationId")
        return try {
            val app = JarvisApplication.instance
            val executionResult = app.automationManager.executeAutomationById(
                automationId = automationId,
                triggerType = TriggerType.INTERVAL_TRIGGER
            )
            if (executionResult?.status == com.openjarvis.android.automation.model.ExecutionStatus.SUCCESS) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            JarvisLogger.e("AutomationWorker", "Error executing worker automation: ${e.message}")
            Result.retry()
        }
    }
}
