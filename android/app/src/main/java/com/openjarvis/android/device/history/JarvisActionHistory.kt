package com.openjarvis.android.device.history

import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionType
import java.util.concurrent.CopyOnWriteArrayList

data class ActionHistoryRecord(
    val id: String,
    val timestamp: Long,
    val command: String,
    val actionType: DeviceActionType,
    val status: ActionResultStatus,
    val message: String,
    val latencyMs: Long
)

/**
 * Thread-safe audit log for device control operations.
 * Excludes sensitive personal message bodies or private tokens.
 */
object JarvisActionHistory {

    private const val MAX_HISTORY_SIZE = 150
    private val records = CopyOnWriteArrayList<ActionHistoryRecord>()

    fun record(
        command: String,
        actionType: DeviceActionType,
        status: ActionResultStatus,
        message: String,
        latencyMs: Long
    ) {
        val entry = ActionHistoryRecord(
            id = "act_${System.currentTimeMillis()}_${(100..999).random()}",
            timestamp = System.currentTimeMillis(),
            command = command.take(120),
            actionType = actionType,
            status = status,
            message = message.take(160),
            latencyMs = latencyMs
        )
        records.add(0, entry)

        while (records.size > MAX_HISTORY_SIZE) {
            records.removeAt(records.lastIndex)
        }
    }

    fun getAll(): List<ActionHistoryRecord> = records.toList()

    fun clear() {
        records.clear()
    }
}
