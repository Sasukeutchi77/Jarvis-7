package com.openjarvis.android.automation

import android.content.Context
import com.openjarvis.android.automation.engine.AutomationConditionEngine
import com.openjarvis.android.automation.engine.JarvisAutomationEngine
import com.openjarvis.android.automation.model.*
import com.openjarvis.android.automation.storage.AutomationRepository
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Primary Facade for all JARVIS Automation capabilities on Android.
 * Injected and accessible across the app lifecycle.
 */
class AutomationManager(
    private val context: Context,
    private val secureVault: SecureVault
) {

    val repository = AutomationRepository(context)
    val engine = JarvisAutomationEngine(context, repository, secureVault)
    private val scope = CoroutineScope(Dispatchers.IO)

    val pendingConfirmation: StateFlow<AutomationPendingConfirmation?> = engine.pendingConfirmation

    /**
     * Initializes automations repository and arms active scheduled tasks.
     */
    fun initialize() {
        scope.launch {
            try {
                repository.seedDefaultsIfEmpty()
                rescheduleAllActiveAutomations()
                JarvisLogger.i("AutomationManager", "AutomationManager initialized successfully.")
            } catch (e: Exception) {
                JarvisLogger.e("AutomationManager", "Failed to initialize AutomationManager: ${e.message}")
            }
        }
    }

    /**
     * Reschedules all enabled automations with AlarmManager or WorkManager.
     */
    suspend fun rescheduleAllActiveAutomations() {
        val active = repository.getActiveAutomations()
        JarvisLogger.i("AutomationManager", "Re-arming ${active.size} active automations...")
        for (automation in active) {
            val nextRun = engine.scheduler.scheduleAutomation(automation)
            repository.updateNextRun(automation.id, nextRun)
        }
    }

    // --- CRUD Operations ---

    suspend fun createOrUpdateAutomation(automation: Automation): Pair<Boolean, String?> {
        val (isValid, validationErr) = engine.validator.validateStructure(automation)
        if (!isValid) {
            return Pair(false, validationErr)
        }

        repository.saveAutomation(automation)
        if (automation.enabled) {
            val nextRun = engine.scheduler.scheduleAutomation(automation)
            repository.updateNextRun(automation.id, nextRun)
        } else {
            engine.scheduler.cancelAutomation(automation.id)
        }
        return Pair(true, null)
    }

    suspend fun toggleAutomation(automationId: String, enable: Boolean) {
        val auto = repository.getAutomationById(automationId) ?: return
        repository.setAutomationEnabled(automationId, enable)
        if (enable) {
            val nextRun = engine.scheduler.scheduleAutomation(auto.copy(enabled = true))
            repository.updateNextRun(automationId, nextRun)
        } else {
            engine.scheduler.cancelAutomation(automationId)
            repository.updateNextRun(automationId, null)
        }
    }

    suspend fun deleteAutomation(automationId: String) {
        engine.scheduler.cancelAutomation(automationId)
        repository.deleteAutomation(automationId)
    }

    suspend fun getAutomationById(id: String): Automation? = repository.getAutomationById(id)

    suspend fun getAutomationByName(name: String): Automation? = repository.getAutomationByName(name)

    fun observeAllAutomations(): Flow<List<Automation>> = repository.observeAllAutomations()

    fun observeActiveCount(): Flow<Int> = repository.observeActiveCount()

    fun observeRecentExecutions(limit: Int = 50): Flow<List<ExecutionResult>> = repository.observeRecentExecutions(limit)

    suspend fun clearExecutionHistory() = repository.clearHistory()

    // --- Execution Triggers ---

    suspend fun executeAutomationById(
        automationId: String,
        triggerType: TriggerType,
        evalCtx: AutomationConditionEngine.EvaluationContext = AutomationConditionEngine.EvaluationContext(),
        isSimulated: Boolean = false
    ): ExecutionResult? {
        val automation = repository.getAutomationById(automationId) ?: return null
        return engine.executeAutomation(
            automation = automation,
            triggerType = triggerType,
            evalCtx = evalCtx,
            isSimulated = isSimulated
        )
    }

    suspend fun testAutomation(automationId: String): ExecutionResult? {
        val automation = repository.getAutomationById(automationId) ?: return null
        return engine.executeAutomation(
            automation = automation,
            triggerType = TriggerType.MANUAL_TRIGGER,
            isSimulated = true
        )
    }

    /**
     * Dispatches notification arrival event to trigger any matching notification automations.
     */
    suspend fun handleNotificationArrived(
        packageName: String,
        sender: String,
        title: String,
        content: String
    ) {
        val automations = repository.getActiveAutomationsByTrigger(TriggerType.NOTIFICATION_TRIGGER)
        if (automations.isEmpty()) return

        val evalCtx = AutomationConditionEngine.EvaluationContext(
            notificationPackage = packageName,
            notificationSender = sender,
            notificationTitle = title,
            notificationContent = content
        )

        for (auto in automations) {
            val trig = auto.trigger
            val matchesPackage = trig.notificationPackage.isNullOrBlank() || trig.notificationPackage.equals(packageName, true)
            val matchesSender = trig.notificationSender.isNullOrBlank() || sender.contains(trig.notificationSender, true)
            val matchesKeyword = trig.notificationKeyword.isNullOrBlank() || content.contains(trig.notificationKeyword, true) || title.contains(trig.notificationKeyword, true)

            if (matchesPackage && matchesSender && matchesKeyword) {
                engine.executeAutomation(
                    automation = auto,
                    triggerType = TriggerType.NOTIFICATION_TRIGGER,
                    evalCtx = evalCtx
                )
            }
        }
    }

    /**
     * Dispatches charging state changes.
     */
    suspend fun handleChargingChanged(isCharging: Boolean) {
        val automations = repository.getActiveAutomationsByTrigger(TriggerType.CHARGING_TRIGGER)
        for (auto in automations) {
            val targetCharging = auto.trigger.isCharging ?: true
            if (targetCharging == isCharging) {
                engine.executeAutomation(
                    automation = auto,
                    triggerType = TriggerType.CHARGING_TRIGGER,
                    evalCtx = AutomationConditionEngine.EvaluationContext(isCharging = isCharging)
                )
            }
        }
    }

    /**
     * Dispatches battery low/okay state events.
     */
    suspend fun handleBatteryStateChanged(isLow: Boolean) {
        val automations = repository.getActiveAutomationsByTrigger(TriggerType.BATTERY_TRIGGER)
        for (auto in automations) {
            if (isLow && auto.trigger.batteryTriggerBelow) {
                engine.executeAutomation(
                    automation = auto,
                    triggerType = TriggerType.BATTERY_TRIGGER,
                    evalCtx = AutomationConditionEngine.EvaluationContext(batteryLevel = 15, isCharging = false)
                )
            }
        }
    }
}
