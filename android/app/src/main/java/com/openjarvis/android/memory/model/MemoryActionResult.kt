package com.openjarvis.android.memory.model

import com.openjarvis.android.storage.database.entity.MemoryEntity

enum class MemoryCommandType {
    REMEMBER,
    FORGET,
    SHOW_MEMORY,
    SEARCH_MEMORY,
    UPDATE_MEMORY,
    CLEAR_MEMORY,
    MEMORY_STATUS,
    EXPLAIN_MEMORY,
    UNKNOWN
}

enum class MemoryResultStatus {
    SUCCESS,
    FAILED,
    REQUIRES_CONFIRMATION,
    CANCELLED,
    SECURITY_REJECTED,
    NOT_FOUND,
    DISABLED
}

data class MemoryActionResult(
    val status: MemoryResultStatus,
    val spokenMessage: String,
    val actionType: MemoryCommandType,
    val item: MemoryEntity? = null,
    val items: List<MemoryEntity> = emptyList(),
    val details: Map<String, Any?> = emptyMap()
) {
    val isSuccess: Boolean get() = status == MemoryResultStatus.SUCCESS
}

data class MemoryConfirmation(
    val id: String,
    val prompt: String,
    val actionType: MemoryCommandType,
    val targetDescription: String,
    val executeAction: suspend () -> MemoryActionResult,
    val onCancel: (() -> Unit)? = null
)
