package com.openjarvis.android.automation.storage

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.openjarvis.android.automation.model.Automation

/**
 * Room Database Entity for persistent Automations in JARVIS.
 */
@Entity(
    tableName = "jarvis_automations",
    indices = [
        Index(value = ["enabled"]),
        Index(value = ["triggerType"]),
        Index(value = ["nextRun"])
    ]
)
data class AutomationEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val description: String = "",
    val enabled: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val triggerType: String,
    val triggerJson: String,
    val conditionsJson: String,
    val actionsJson: String,
    val priority: Int = 1,
    val runCount: Int = 0,
    val lastRun: Long? = null,
    val nextRun: Long? = null,
    val requiresConfirmation: Boolean = false,
    val cooldownSeconds: Long = 60L,
    val lastTriggeredAt: Long? = null,
    val isSystem: Boolean = false
) {
    fun toDomain(): Automation {
        return Automation(
            id = id,
            name = name,
            description = description,
            enabled = enabled,
            createdAt = createdAt,
            updatedAt = updatedAt,
            trigger = AutomationJsonAdapter.jsonToTrigger(triggerJson),
            conditions = AutomationJsonAdapter.jsonToConditions(conditionsJson),
            actions = AutomationJsonAdapter.jsonToActions(actionsJson),
            priority = priority,
            runCount = runCount,
            lastRun = lastRun,
            nextRun = nextRun,
            requiresConfirmation = requiresConfirmation,
            cooldownSeconds = cooldownSeconds,
            lastTriggeredAt = lastTriggeredAt,
            isSystem = isSystem
        )
    }

    companion object {
        fun fromDomain(domain: Automation): AutomationEntity {
            return AutomationEntity(
                id = domain.id,
                name = domain.name,
                description = domain.description,
                enabled = domain.enabled,
                createdAt = domain.createdAt,
                updatedAt = domain.updatedAt,
                triggerType = domain.trigger.type.name,
                triggerJson = AutomationJsonAdapter.triggerToJson(domain.trigger),
                conditionsJson = AutomationJsonAdapter.conditionsToJson(domain.conditions),
                actionsJson = AutomationJsonAdapter.actionsToJson(domain.actions),
                priority = domain.priority,
                runCount = domain.runCount,
                lastRun = domain.lastRun,
                nextRun = domain.nextRun,
                requiresConfirmation = domain.requiresConfirmation,
                cooldownSeconds = domain.cooldownSeconds,
                lastTriggeredAt = domain.lastTriggeredAt,
                isSystem = domain.isSystem
            )
        }
    }
}
