package com.openjarvis.android.automation.storage

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AutomationDao {

    // --- Automations CRUD ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAutomation(entity: AutomationEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAutomations(entities: List<AutomationEntity>)

    @Update
    suspend fun updateAutomation(entity: AutomationEntity)

    @Query("DELETE FROM jarvis_automations WHERE id = :id")
    suspend fun deleteAutomation(id: String)

    @Query("DELETE FROM jarvis_automations WHERE isSystem = 0")
    suspend fun clearUserAutomations()

    @Query("SELECT * FROM jarvis_automations WHERE id = :id LIMIT 1")
    suspend fun getAutomationById(id: String): AutomationEntity?

    @Query("SELECT * FROM jarvis_automations WHERE name = :name LIMIT 1")
    suspend fun getAutomationByName(name: String): AutomationEntity?

    @Query("SELECT * FROM jarvis_automations WHERE enabled = 1")
    suspend fun getActiveAutomations(): List<AutomationEntity>

    @Query("SELECT * FROM jarvis_automations WHERE enabled = 1 AND triggerType = :triggerType")
    suspend fun getActiveAutomationsByTrigger(triggerType: String): List<AutomationEntity>

    @Query("SELECT * FROM jarvis_automations ORDER BY priority DESC, createdAt DESC")
    suspend fun getAllAutomations(): List<AutomationEntity>

    @Query("SELECT * FROM jarvis_automations ORDER BY priority DESC, createdAt DESC")
    fun observeAllAutomations(): Flow<List<AutomationEntity>>

    @Query("SELECT COUNT(*) FROM jarvis_automations WHERE enabled = 1")
    fun observeActiveCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM jarvis_automations")
    suspend fun getTotalCount(): Int

    @Query("UPDATE jarvis_automations SET enabled = :enabled, updatedAt = :updatedAt WHERE id = :id")
    suspend fun setAutomationEnabled(id: String, enabled: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE jarvis_automations SET lastRun = :lastRun, runCount = runCount + 1, lastTriggeredAt = :lastRun WHERE id = :id")
    suspend fun recordExecution(id: String, lastRun: Long = System.currentTimeMillis())

    @Query("UPDATE jarvis_automations SET nextRun = :nextRun WHERE id = :id")
    suspend fun updateNextRun(id: String, nextRun: Long?)

    // --- Execution History ---

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExecution(execution: AutomationExecutionEntity)

    @Query("SELECT * FROM jarvis_automation_executions ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentExecutions(limit: Int = 50): List<AutomationExecutionEntity>

    @Query("SELECT * FROM jarvis_automation_executions ORDER BY timestamp DESC LIMIT :limit")
    fun observeRecentExecutions(limit: Int = 50): Flow<List<AutomationExecutionEntity>>

    @Query("SELECT * FROM jarvis_automation_executions WHERE automationId = :automationId ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getExecutionsByAutomation(automationId: String, limit: Int = 20): List<AutomationExecutionEntity>

    @Query("DELETE FROM jarvis_automation_executions WHERE timestamp < :cutoffTimestamp")
    suspend fun purgeOldExecutions(cutoffTimestamp: Long)

    @Query("DELETE FROM jarvis_automation_executions")
    suspend fun clearHistory()
}
