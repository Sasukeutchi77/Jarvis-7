package com.openjarvis.android.storage.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class MemoryCategory {
    PREFERENCE,
    HABIT,
    IMPORTANT_FACT,
    USER_PROFILE,
    CONVERSATION_CONTEXT,
    AUTOMATION_NOTE
}

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey val id: String,
    val source: String,
    val category: String = MemoryCategory.IMPORTANT_FACT.name,
    val content: String,
    val metadataJson: String = "{}",
    val chunkIndex: Int = 0,
    val totalChunks: Int = 1,
    val importanceScore: Float = 1.0f,
    val isEncrypted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
