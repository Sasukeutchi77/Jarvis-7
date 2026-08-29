package com.openjarvis.android.automation.storage

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.openjarvis.android.automation.model.ExecutionResult
import com.openjarvis.android.automation.model.ExecutionStatus
import com.openjarvis.android.automation.model.TriggerType
import org.json.JSONArray

/**
 * Room Database Entity for tracking execution logs and diagnostics history.
 * Protects user privacy by storing metadata and structured codes rather than private message bodies.
 */
@Entity(
    tableName = "jarvis_automation_executions",
    indices = [
        Index(value = ["automationId"]),
        Index(value = ["timestamp"]),
        Index(value = ["status"])
    ]
)
data class AutomationExecutionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val automationId: String,
    val automationName: String,
    val timestamp: Long = System.currentTimeMillis(),
    val triggerType: String,
    val status: String,
    val durationMs: Long = 0L,
    val errorCode: String? = null,
    val executedActionsJson: String = "[]",
    val spokenMessageSummary: String? = null,
    val isSimulated: Boolean = false
) {
    fun toDomain(): ExecutionResult {
        val actionsList = mutableListOf<String>()
        try {
            val arr = JSONArray(executedActionsJson)
            for (i in 0 until arr.length()) {
                actionsList.add(arr.getString(i))
            }
        } catch (_: Exception) {}

        return ExecutionResult(
            automationId = automationId,
            automationName = automationName,
            timestamp = timestamp,
            trigger = TriggerType.fromString(triggerType),
            status = ExecutionStatus.fromString(status),
            durationMs = durationMs,
            errorCode = errorCode,
            executedActions = actionsList,
            spokenMessage = spokenMessageSummary,
            isSimulated = isSimulated
        )
    }

    companion object {
        fun fromDomain(domain: ExecutionResult): AutomationExecutionEntity {
            val arr = JSONArray()
            domain.executedActions.forEach { arr.put(it) }
            return AutomationExecutionEntity(
                automationId = domain.automationId,
                automationName = domain.automationName,
                timestamp = domain.timestamp,
                triggerType = domain.trigger.name,
                status = domain.status.name,
                durationMs = domain.durationMs,
                errorCode = domain.errorCode,
                executedActionsJson = arr.toString(),
                spokenMessageSummary = domain.spokenMessage?.take(150),
                isSimulated = domain.isSimulated
            )
        }
    }
}
