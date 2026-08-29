package com.openjarvis.android.automation.storage

import android.content.Context
import com.openjarvis.android.automation.model.*
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.database.JarvisDatabase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Repository interface & implementation for persistent Automations and Execution History.
 */
class AutomationRepository(private val context: Context) {

    private val database = JarvisDatabase.getInstance(context)
    private val dao = database.automationDao()

    suspend fun saveAutomation(automation: Automation) {
        val entity = AutomationEntity.fromDomain(automation)
        dao.insertAutomation(entity)
        JarvisLogger.i("AutomationRepo", "Saved automation [${automation.name}] (enabled=${automation.enabled})")
    }

    suspend fun updateAutomation(automation: Automation) {
        val entity = AutomationEntity.fromDomain(automation.copy(updatedAt = System.currentTimeMillis()))
        dao.updateAutomation(entity)
        JarvisLogger.d("AutomationRepo", "Updated automation [${automation.name}]")
    }

    suspend fun getAutomationById(id: String): Automation? {
        return dao.getAutomationById(id)?.toDomain()
    }

    suspend fun getAutomationByName(name: String): Automation? {
        return dao.getAutomationByName(name)?.toDomain()
    }

    suspend fun getActiveAutomations(): List<Automation> {
        return dao.getActiveAutomations().map { it.toDomain() }
    }

    suspend fun getActiveAutomationsByTrigger(triggerType: TriggerType): List<Automation> {
        return dao.getActiveAutomationsByTrigger(triggerType.name).map { it.toDomain() }
    }

    suspend fun getAllAutomations(): List<Automation> {
        return dao.getAllAutomations().map { it.toDomain() }
    }

    fun observeAllAutomations(): Flow<List<Automation>> {
        return dao.observeAllAutomations().map { list -> list.map { it.toDomain() } }
    }

    fun observeActiveCount(): Flow<Int> {
        return dao.observeActiveCount()
    }

    suspend fun deleteAutomation(id: String) {
        dao.deleteAutomation(id)
        JarvisLogger.i("AutomationRepo", "Deleted automation with id: $id")
    }

    suspend fun setAutomationEnabled(id: String, enabled: Boolean) {
        dao.setAutomationEnabled(id, enabled)
    }

    suspend fun recordExecution(id: String, timestamp: Long = System.currentTimeMillis()) {
        dao.recordExecution(id, timestamp)
    }

    suspend fun updateNextRun(id: String, nextRun: Long?) {
        dao.updateNextRun(id, nextRun)
    }

    // --- Execution Logs ---

    suspend fun logExecution(result: ExecutionResult) {
        val entity = AutomationExecutionEntity.fromDomain(result)
        dao.insertExecution(entity)
        JarvisLogger.i("AutomationRepo", "Logged execution result for [${result.automationName}]: ${result.status}")
    }

    suspend fun getRecentExecutions(limit: Int = 50): List<ExecutionResult> {
        return dao.getRecentExecutions(limit).map { it.toDomain() }
    }

    fun observeRecentExecutions(limit: Int = 50): Flow<List<ExecutionResult>> {
        return dao.observeRecentExecutions(limit).map { list -> list.map { it.toDomain() } }
    }

    suspend fun clearHistory() {
        dao.clearHistory()
    }

    /**
     * Seeds initial default system presets if the repository is completely empty.
     */
    suspend fun seedDefaultsIfEmpty() {
        if (dao.getTotalCount() == 0) {
            JarvisLogger.i("AutomationRepo", "Seeding default intelligent JARVIS automations...")
            val defaultAutomations = listOf(
                Automation(
                    id = "sys_morning_briefing",
                    name = "Briefing Matinal JARVIS",
                    description = "Chaque matin à 07:00 : Heure, météo, statut batterie et synthèse vocale.",
                    enabled = true,
                    trigger = AutomationTrigger(
                        type = TriggerType.TIME_TRIGGER,
                        timeOfDay = "07:00",
                        repeatPattern = RepeatPattern.DAILY
                    ),
                    conditions = emptyList(),
                    actions = listOf(
                        AutomationAction(type = ActionType.START_BRIEFING)
                    ),
                    priority = 10,
                    isSystem = true
                ),
                Automation(
                    id = "sys_battery_low_alert",
                    name = "Alerte Batterie Faible (20%)",
                    description = "Prévenir vocalement et par notification dès que la batterie descend sous 20%.",
                    enabled = true,
                    trigger = AutomationTrigger(
                        type = TriggerType.BATTERY_TRIGGER,
                        batteryThreshold = 20,
                        batteryTriggerBelow = true
                    ),
                    conditions = listOf(
                        AutomationCondition(
                            field = "is_charging",
                            operator = ConditionOperator.EQUALS,
                            value = "false"
                        )
                    ),
                    actions = listOf(
                        AutomationAction(
                            type = ActionType.SPEAK,
                            message = "Monsieur, le niveau de batterie est descendu sous 20%. Je vous conseille de brancher votre appareil."
                        ),
                        AutomationAction(
                            type = ActionType.SHOW_NOTIFICATION,
                            notificationTitle = "JARVIS - Alerte Énergie",
                            notificationBody = "Batterie sous 20%. Veuillez recharger l'appareil."
                        )
                    ),
                    cooldownSeconds = 300L,
                    priority = 5,
                    isSystem = true
                ),
                Automation(
                    id = "sys_charging_alert",
                    name = "Notification Mise en Charge",
                    description = "Confirmation vocale dès que le téléphone est branché au secteur.",
                    enabled = true,
                    trigger = AutomationTrigger(
                        type = TriggerType.CHARGING_TRIGGER,
                        isCharging = true
                    ),
                    actions = listOf(
                        AutomationAction(
                            type = ActionType.SPEAK,
                            message = "Alimentation principale connectée. Charge en cours."
                        )
                    ),
                    cooldownSeconds = 60L,
                    priority = 3,
                    isSystem = true
                )
            )
            defaultAutomations.forEach { saveAutomation(it) }
        }
    }
}
