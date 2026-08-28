package com.openjarvis.android.memory.repository

import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.storage.database.dao.JarvisMemoryDao
import com.openjarvis.android.storage.database.entity.MemoryEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

/**
 * Concrete local repository for persisting, querying, and managing JARVIS memories in Room.
 * Optional encryption integration using SecureVault / Keystore for sensitive entries.
 */
class MemoryRepository(
    private val memoryDao: JarvisMemoryDao,
    private val secureVault: SecureVault
) {

    suspend fun insertOrUpdate(memory: MemoryEntity) = withContext(Dispatchers.IO) {
        val processedMemory = if (memory.isEncrypted) {
            val encryptedContent = secureVault.encrypt(memory.content)
            memory.copy(content = encryptedContent)
        } else {
            memory
        }
        memoryDao.insertMemory(processedMemory)
        JarvisLogger.d("MemoryRepository", "Persisted memory ${memory.id} (cat=${memory.category}, key=${memory.dedupKey})")
    }

    suspend fun getById(id: String): MemoryEntity? = withContext(Dispatchers.IO) {
        val raw = memoryDao.getMemoryById(id) ?: return@withContext null
        decryptIfNeeded(raw)
    }

    suspend fun getByKey(dedupKey: String): MemoryEntity? = withContext(Dispatchers.IO) {
        val raw = memoryDao.getMemoryByKey(dedupKey) ?: return@withContext null
        decryptIfNeeded(raw)
    }

    suspend fun getByCategory(category: MemoryCategory): List<MemoryEntity> = withContext(Dispatchers.IO) {
        val rawList = memoryDao.getMemoriesByCategory(category.name)
        rawList.map { decryptIfNeeded(it) }
    }

    suspend fun getAll(): List<MemoryEntity> = withContext(Dispatchers.IO) {
        val rawList = memoryDao.getAllMemories()
        rawList.map { decryptIfNeeded(it) }
    }

    fun observeAll(): Flow<List<MemoryEntity>> {
        return memoryDao.observeAllMemories()
    }

    fun observeCount(): Flow<Int> {
        return memoryDao.observeMemoryCount()
    }

    suspend fun searchFts(query: String, limit: Int = 10): List<MemoryEntity> = withContext(Dispatchers.IO) {
        val raw = try {
            memoryDao.searchFts(query, limit)
        } catch (e: Exception) {
            emptyList()
        }
        raw.map { decryptIfNeeded(it) }
    }

    suspend fun searchLike(query: String, limit: Int = 10): List<MemoryEntity> = withContext(Dispatchers.IO) {
        val raw = memoryDao.searchLike(query, limit)
        raw.map { decryptIfNeeded(it) }
    }

    suspend fun deleteById(id: String) = withContext(Dispatchers.IO) {
        memoryDao.deleteMemory(id)
        JarvisLogger.i("MemoryRepository", "Deleted memory $id")
    }

    suspend fun deleteByKey(dedupKey: String) = withContext(Dispatchers.IO) {
        memoryDao.deleteByKey(dedupKey)
        JarvisLogger.i("MemoryRepository", "Deleted memory with key $dedupKey")
    }

    suspend fun clearAll() = withContext(Dispatchers.IO) {
        memoryDao.clearAll()
        JarvisLogger.w("MemoryRepository", "Cleared all memories from database")
    }

    suspend fun cleanupExpired() = withContext(Dispatchers.IO) {
        memoryDao.deleteExpired()
    }

    private fun decryptIfNeeded(entity: MemoryEntity): MemoryEntity {
        if (!entity.isEncrypted) return entity
        return try {
            val decrypted = secureVault.decrypt(entity.content)
            entity.copy(content = decrypted)
        } catch (e: Exception) {
            JarvisLogger.e("MemoryRepository", "Failed to decrypt memory ${entity.id}", e)
            entity
        }
    }
}
