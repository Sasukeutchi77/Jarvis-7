package com.openjarvis.android.storage.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "execution_traces")
data class TraceEntity(
    @PrimaryKey(autoGenerate = true) val traceId: Long = 0,
    val sessionId: String,
    val prompt: String,
    val modelUsed: String,
    val engineType: String,
    val ttftMs: Long,
    val totalTimeMs: Long,
    val promptTokens: Int,
    val completionTokens: Int,
    val estimatedJoules: Double,
    val success: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)
