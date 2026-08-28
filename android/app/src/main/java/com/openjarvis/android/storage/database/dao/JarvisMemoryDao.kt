package com.openjarvis.android.storage.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.openjarvis.android.storage.database.entity.MemoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface JarvisMemoryDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemory(memory: MemoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMemories(memories: List<MemoryEntity>)

    @Update
    suspend fun updateMemory(memory: MemoryEntity)

    @Query("DELETE FROM jarvis_memories WHERE id = :id")
    suspend fun deleteMemory(id: String)

    @Query("DELETE FROM jarvis_memories WHERE dedupKey = :dedupKey")
    suspend fun deleteByKey(dedupKey: String)

    @Query("DELETE FROM jarvis_memories")
    suspend fun clearAll()

    @Query("DELETE FROM jarvis_memories WHERE expiresAt IS NOT NULL AND expiresAt < :currentTime")
    suspend fun deleteExpired(currentTime: Long = System.currentTimeMillis())

    @Query("SELECT * FROM jarvis_memories WHERE id = :id LIMIT 1")
    suspend fun getMemoryById(id: String): MemoryEntity?

    @Query("SELECT * FROM jarvis_memories WHERE dedupKey = :dedupKey AND enabled = 1 LIMIT 1")
    suspend fun getMemoryByKey(dedupKey: String): MemoryEntity?

    @Query("SELECT * FROM jarvis_memories WHERE category = :category AND enabled = 1 ORDER BY updatedAt DESC")
    suspend fun getMemoriesByCategory(category: String): List<MemoryEntity>

    @Query("SELECT * FROM jarvis_memories WHERE enabled = 1 ORDER BY updatedAt DESC")
    suspend fun getAllMemories(): List<MemoryEntity>

    @Query("SELECT * FROM jarvis_memories ORDER BY updatedAt DESC")
    fun observeAllMemories(): Flow<List<MemoryEntity>>

    @Query("SELECT COUNT(*) FROM jarvis_memories WHERE enabled = 1")
    fun observeMemoryCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM jarvis_memories WHERE enabled = 1")
    suspend fun getMemoryCount(): Int

    @Query("""
        SELECT m.* FROM jarvis_memories m
        JOIN jarvis_memories_fts fts ON m.id = fts.rowid
        WHERE jarvis_memories_fts MATCH :searchQuery AND m.enabled = 1
        ORDER BY m.importance DESC, m.updatedAt DESC
        LIMIT :limit
    """)
    suspend fun searchFts(searchQuery: String, limit: Int = 10): List<MemoryEntity>

    @Query("""
        SELECT * FROM jarvis_memories
        WHERE (content LIKE '%' || :query || '%' OR category LIKE '%' || :query || '%')
        AND enabled = 1
        ORDER BY importance DESC, updatedAt DESC
        LIMIT :limit
    """)
    suspend fun searchLike(query: String, limit: Int = 10): List<MemoryEntity>
}
