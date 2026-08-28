package com.openjarvis.android.storage.database.entity

import androidx.room.Entity
import androidx.room.Fts4

@Fts4(contentEntity = MemoryEntity::class)
@Entity(tableName = "jarvis_memories_fts")
data class MemoryFtsEntity(
    val rowid: Int,
    val content: String,
    val category: String,
    val source: String
)
