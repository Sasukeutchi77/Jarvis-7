package com.openjarvis.android.automation.engine

import com.openjarvis.android.automation.model.ActionType
import com.openjarvis.android.automation.model.Automation
import com.openjarvis.android.automation.model.TriggerType
import com.openjarvis.android.logging.JarvisLogger
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Validates automations against syntax flaws, infinite loop chains, and excessive battery/rate usage.
 */
class AutomationValidator {

    companion object {
        const val MAX_CHAIN_DEPTH = 4
        const val MAX_GLOBAL_EXECUTIONS_PER_MINUTE = 15
        const val MAX_SINGLE_EXECUTIONS_PER_MINUTE = 6
    }

    // Rate Limiting Tracking: AutomationId -> Timestamps list
    private val executionTimestamps = ConcurrentHashMap<String, MutableList<Long>>()
    private val globalExecutionTimestamps = mutableListOf<Long>()

    /**
     * Validates schema and structural integrity of an Automation.
     */
    fun validateStructure(automation: Automation): Pair<Boolean, String?> {
        if (automation.name.isBlank()) {
            return Pair(false, "Le nom de l'automatisation ne peut pas être vide.")
        }
        if (automation.actions.isEmpty()) {
            return Pair(false, "L'automatisation doit contenir au moins une action.")
        }

        when (automation.trigger.type) {
            TriggerType.TIME_TRIGGER -> {
                if (automation.trigger.timeOfDay.isNullOrBlank()) {
                    return Pair(false, "Une heure de déclenchement (HH:mm) est requise.")
                }
            }
            TriggerType.DATE_TRIGGER -> {
                if (automation.trigger.targetTimestamp == null || automation.trigger.targetTimestamp <= 0) {
                    return Pair(false, "Une date et heure future exacte est requise.")
                }
            }
            TriggerType.INTERVAL_TRIGGER -> {
                if (automation.trigger.intervalMinutes == null || automation.trigger.intervalMinutes < 15) {
                    // Android WorkManager minimum periodic interval is 15 minutes
                    return Pair(false, "L'intervalle minimum supporté par Android est de 15 minutes.")
                }
            }
            TriggerType.BATTERY_TRIGGER -> {
                val threshold = automation.trigger.batteryThreshold
                if (threshold == null || threshold !in 1..100) {
                    return Pair(false, "Le seuil de batterie doit être compris entre 1 et 100%.")
                }
            }
            else -> {}
        }

        // Validate Actions
        for (action in automation.actions) {
            if (action.type == ActionType.SEND_SMS) {
                if (action.phoneNumber.isNullOrBlank() && action.contactName.isNullOrBlank()) {
                    return Pair(false, "Un numéro de téléphone ou un contact est requis pour envoyer un SMS.")
                }
                if (action.message.isNullOrBlank()) {
                    return Pair(false, "Le message SMS ne peut pas être vide.")
                }
            }
        }

        return Pair(true, null)
    }

    /**
     * Checks if cooldown period has elapsed since last trigger.
     */
    fun isCooldownActive(automation: Automation, currentTime: Long = System.currentTimeMillis()): Boolean {
        val lastTrigger = automation.lastTriggeredAt ?: return false
        val cooldownMs = automation.cooldownSeconds * 1000L
        val isCoolingDown = (currentTime - lastTrigger) < cooldownMs
        if (isCoolingDown) {
            JarvisLogger.d("AutomationValidator", "Automation [${automation.name}] skipped due to active cooldown (${(cooldownMs - (currentTime - lastTrigger)) / 1000}s remaining).")
        }
        return isCoolingDown
    }

    /**
     * Verifies rate limits to protect device battery and CPU.
     */
    @Synchronized
    fun isRateLimitExceeded(automationId: String, currentTime: Long = System.currentTimeMillis()): Boolean {
        val oneMinuteAgo = currentTime - 60_000L

        // Clean global timestamps
        globalExecutionTimestamps.removeAll { it < oneMinuteAgo }
        if (globalExecutionTimestamps.size >= MAX_GLOBAL_EXECUTIONS_PER_MINUTE) {
            JarvisLogger.w("AutomationValidator", "Global automation rate limit exceeded ($MAX_GLOBAL_EXECUTIONS_PER_MINUTE/min).")
            return true
        }

        // Clean single automation timestamps
        val timestamps = executionTimestamps.getOrPut(automationId) { mutableListOf() }
        timestamps.removeAll { it < oneMinuteAgo }
        if (timestamps.size >= MAX_SINGLE_EXECUTIONS_PER_MINUTE) {
            JarvisLogger.w("AutomationValidator", "Rate limit exceeded for automation $automationId ($MAX_SINGLE_EXECUTIONS_PER_MINUTE/min).")
            return true
        }

        timestamps.add(currentTime)
        globalExecutionTimestamps.add(currentTime)
        return false
    }

    /**
     * Checks recursion depth to prevent infinite loops (A -> B -> A).
     */
    fun checkChainDepth(currentDepth: Int): Boolean {
        if (currentDepth > MAX_CHAIN_DEPTH) {
            JarvisLogger.e("AutomationValidator", "Automation recursion loop detected! Depth ($currentDepth) exceeded maximum allowed ($MAX_CHAIN_DEPTH). Aborting.")
            return false
        }
        return true
    }
}
