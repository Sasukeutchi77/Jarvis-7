package com.openjarvis.android.storage.database.entity

import androidx.room.Entity
import androidx.room.Fts4

@Fts4(contentEntity = DocumentEntity::class)
@Entity(tableName = "documents_fts")
data class DocumentFtsEntity(
    val rowid: Int,
    val source: String,
    val content: String
)
