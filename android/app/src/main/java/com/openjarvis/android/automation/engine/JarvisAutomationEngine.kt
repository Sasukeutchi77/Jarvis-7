package com.openjarvis.android.automation.engine

import android.content.Context
import com.openjarvis.android.automation.model.*
import com.openjarvis.android.automation.storage.AutomationRepository
import com.openjarvis.android.core.events.AgentState
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

/**
 * Core Automation Engine for JARVIS on Android.
 * Coordinates validation, condition trees, action dispatch, rate limiting, and diagnostics.
 */
class JarvisAutomationEngine(
    private val context: Context,
    private val repository: AutomationRepository,
    private val secureVault: SecureVault
) {

    val permissionManager = AutomationPermissionManager(context)
    val scheduler = AutomationScheduler(context, permissionManager)
    val conditionEngine = AutomationConditionEngine(context)
    val actionExecutor = AutomationActionExecutor(context, secureVault)
    val validator = AutomationValidator()

    private val _pendingConfirmation = MutableStateFlow<AutomationPendingConfirmation?>(null)
    val pendingConfirmation: StateFlow<AutomationPendingConfirmation?> = _pendingConfirmation.asStateFlow()

    /**
     * Executes an automation if active, conditions met, and cooldown permits.
     */
    suspend fun executeAutomation(
        automation: Automation,
        triggerType: TriggerType,
        evalCtx: AutomationConditionEngine.EvaluationContext = AutomationConditionEngine.EvaluationContext(),
        isSimulated: Boolean = false,
        recursionDepth: Int = 1
    ): ExecutionResult = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        JarvisLogger.i("AutomationEngine", "Triggering automation [${automation.name}] via $triggerType (depth=$recursionDepth, sim=$isSimulated)...")

        // Check Recursion Guard
        if (!validator.checkChainDepth(recursionDepth)) {
            val res = ExecutionResult(
                automationId = automation.id,
                automationName = automation.name,
                trigger = triggerType,
                status = ExecutionStatus.FAILED,
                errorCode = "ERR_RECURSION_DEPTH_EXCEEDED",
                isSimulated = isSimulated
            )
            repository.logExecution(res)
            return@withContext res
        }

        // Check Enabled
        if (!automation.enabled && !isSimulated) {
            JarvisLogger.d("AutomationEngine", "Automation [${automation.name}] is disabled. Skipping.")
            return@withContext ExecutionResult(
                automationId = automation.id,
                automationName = automation.name,
                trigger = triggerType,
                status = ExecutionStatus.SKIPPED,
                errorCode = "AUTOMATION_DISABLED",
                isSimulated = isSimulated
            )
        }

        // Check Cooldown & Rate Limits
        if (!isSimulated) {
            if (validator.isCooldownActive(automation, startTime)) {
                return@withContext ExecutionResult(
                    automationId = automation.id,
                    automationName = automation.name,
                    trigger = triggerType,
                    status = ExecutionStatus.SKIPPED,
                    errorCode = "COOLDOWN_ACTIVE",
                    isSimulated = false
                )
            }
            if (validator.isRateLimitExceeded(automation.id, startTime)) {
                return@withContext ExecutionResult(
                    automationId = automation.id,
                    automationName = automation.name,
                    trigger = triggerType,
                    status = ExecutionStatus.SKIPPED,
                    errorCode = "RATE_LIMIT_EXCEEDED",
                    isSimulated = false
                )
            }
        }

        // Validate Permissions
        val (hasPerms, permError) = permissionManager.canExecuteAutomation(automation)
        if (!hasPerms && !isSimulated) {
            val res = ExecutionResult(
                automationId = automation.id,
                automationName = automation.name,
                trigger = triggerType,
                status = ExecutionStatus.PERMISSION_REQUIRED,
                errorCode = permError,
                isSimulated = false
            )
            repository.logExecution(res)
            return@withContext res
        }

        // Evaluate Condition Trees (AND / OR / NOT / relational)
        val conditionsMet = conditionEngine.evaluateConditions(automation.conditions, evalCtx)
        if (!conditionsMet && !isSimulated) {
            JarvisLogger.d("AutomationEngine", "Conditions for [${automation.name}] evaluated to FALSE. Skipping.")
            val res = ExecutionResult(
                automationId = automation.id,
                automationName = automation.name,
                trigger = triggerType,
                status = ExecutionStatus.SKIPPED,
                errorCode = "CONDITIONS_NOT_MET",
                isSimulated = false
            )
            repository.logExecution(res)
            return@withContext res
        }

        // Notify Hologram & Event Bus: State changed to AUTOMATION
        JarvisEventBus.emit(JarvisEvent.StateChanged(AgentState.THINKING))

        val executedActionNames = mutableListOf<String>()
        var lastSpokenMessage: String? = null
        var overallStatus = ExecutionStatus.SUCCESS
        var errorCode: String? = null

        // Execute Actions Sequentially
        for (action in automation.actions) {
            // Check if Sensitive Confirmation Required
            if ((automation.requiresConfirmation || action.isSensitive) && !isSimulated) {
                JarvisLogger.i("AutomationEngine", "Sensitive action ${action.type} requires user confirmation.")
                // Set pending confirmation and await user response
                _pendingConfirmation.value = AutomationPendingConfirmation(
                    automationId = automation.id,
                    automationName = automation.name,
                    action = action,
                    prompt = "L'action sensible « ${action.type.frenchLabel} » pour « ${automation.name} » nécessite votre autorisation.",
                    onConfirm = {
                        val (success, spoken) = actionExecutor.executeAction(action, automation.id, automation.name, isSimulated = false)
                        val dur = System.currentTimeMillis() - startTime
                        val res = ExecutionResult(
                            automationId = automation.id,
                            automationName = automation.name,
                            trigger = triggerType,
                            status = if (success) ExecutionStatus.SUCCESS else ExecutionStatus.FAILED,
                            durationMs = dur,
                            executedActions = listOf(action.type.name),
                            spokenMessage = spoken
                        )
                        repository.logExecution(res)
                        _pendingConfirmation.value = null
                        res
                    }
                )
                return@withContext ExecutionResult(
                    automationId = automation.id,
                    automationName = automation.name,
                    trigger = triggerType,
                    status = ExecutionStatus.PENDING_CONFIRMATION,
                    isSimulated = false
                )
            }

            val (success, spoken) = actionExecutor.executeAction(
                action = action,
                automationId = automation.id,
                automationName = automation.name,
                isTestMode = isSimulated
            )

            executedActionNames.add(action.type.name)
            if (spoken != null) {
                lastSpokenMessage = spoken
            }

            if (!success) {
                overallStatus = ExecutionStatus.FAILED
                errorCode = "ACTION_FAILED_${action.type.name}"
                break
            }
        }

        val durationMs = System.currentTimeMillis() - startTime

        // Update database execution stats and schedule next run if needed
        if (!isSimulated && overallStatus == ExecutionStatus.SUCCESS) {
            repository.recordExecution(automation.id, startTime)
            val nextRunTime = scheduler.scheduleAutomation(automation)
            repository.updateNextRun(automation.id, nextRunTime)
        }

        val finalResult = ExecutionResult(
            automationId = automation.id,
            automationName = automation.name,
            timestamp = startTime,
            trigger = triggerType,
            status = overallStatus,
            durationMs = durationMs,
            errorCode = errorCode,
            executedActions = executedActionNames,
            spokenMessage = lastSpokenMessage,
            isSimulated = isSimulated
        )

        repository.logExecution(finalResult)
        JarvisLogger.i("AutomationEngine", "Completed [${automation.name}] in ${durationMs}ms -> ${overallStatus.frenchLabel}")
        return@withContext finalResult
    }

    fun dismissPendingConfirmation() {
        _pendingConfirmation.value = null
    }
}
