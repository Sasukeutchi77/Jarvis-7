package com.openjarvis.android.storage.database.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.memory.model.MemoryType

@Entity(
    tableName = "jarvis_memories",
    indices = [
        Index(value = ["category"]),
        Index(value = ["type"]),
        Index(value = ["dedupKey"], unique = false),
        Index(value = ["updatedAt"])
    ]
)
data class MemoryEntity(
    @PrimaryKey val id: String,
    val type: String = MemoryType.LONG_TERM.name,
    val category: String = MemoryCategory.PREFERENCE.name,
    val content: String,
    val importance: Float = 1.0f,
    val source: String = "USER_EXPLICIT",
    val dedupKey: String? = null,
    val metadataJson: String = "{}",
    val isEncrypted: Boolean = false,
    val enabled: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long? = null
)
