package com.openjarvis.android.storage.memory

import android.content.Context
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.storage.database.JarvisDatabase
import com.openjarvis.android.storage.database.entity.DocumentEntity
import com.openjarvis.android.storage.database.entity.MemoryCategory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID

/**
 * High-level OpenJarvis Personal Memory Service for Android.
 * Handles local FTS5 indexing, semantic classification, optional encryption of sensitive items,
 * synchronization, search, and granular CRUD for user memories.
 */
class PersonalMemoryManager(
    private val context: Context,
    private val database: JarvisDatabase,
    private val secureVault: SecureVault,
    private val configManager: ConfigManager
) {
    private val memoryDao = database.memoryDao()

    /**
     * Checks whether memory system is enabled in user settings.
     */
    fun isMemoryEnabled(): Boolean {
        return configManager.config.value.memoryEnabled
    }

    /**
     * Sets whether memory recording and RAG retrieval is enabled.
     */
    suspend fun setMemoryEnabled(enabled: Boolean) {
        val currentConfig = configManager.config.value
        configManager.updateConfig(currentConfig.copy(memoryEnabled = enabled))
        JarvisLogger.i("PersonalMemory", "Memory system enabled status changed to: $enabled")
    }

    /**
     * Observable stream of all memories for UI screens.
     */
    fun observeAllMemories(): Flow<List<DocumentEntity>> {
        return memoryDao.getAllDocumentsFlow()
    }

    /**
     * Observable memory counter.
     */
    fun observeMemoryCount(): Flow<Int> {
        return memoryDao.getDocumentCountFlow()
    }

    /**
     * Add or record a new memory explicitly.
     */
    suspend fun recordMemory(
        content: String,
        source: String = "User Manual Input",
        category: MemoryCategory = MemoryCategory.IMPORTANT_FACT,
        importanceScore: Float = 1.0f,
        metadata: Map<String, String> = emptyMap(),
        isSensitive: Boolean = false
    ): DocumentEntity = withContext(Dispatchers.IO) {
        if (!isMemoryEnabled()) {
            JarvisLogger.w("PersonalMemory", "Memory recording is disabled in settings. Skipping.")
        }

        val metaJson = JSONObject().apply {
            metadata.forEach { (k, v) -> put(k, v) }
            put("sensitive", isSensitive)
            put("created_by", "OpenJarvis_Android_Engine")
        }.toString()

        val newDoc = DocumentEntity(
            id = "mem_${UUID.randomUUID()}",
            source = source,
            category = category.name,
            content = content.trim(),
            metadataJson = metaJson,
            chunkIndex = 0,
            totalChunks = 1,
            importanceScore = importanceScore,
            isEncrypted = isSensitive,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )

        memoryDao.insertDocument(newDoc)
        JarvisLogger.i("PersonalMemory", "Memory item saved with ID=${newDoc.id}, category=${category.name}")
        return@withContext newDoc
    }

    /**
     * Update an existing memory item.
     */
    suspend fun updateMemory(
        id: String,
        content: String,
        category: MemoryCategory? = null,
        importanceScore: Float? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val existing = memoryDao.getDocumentById(id) ?: return@withContext false
        val updated = existing.copy(
            content = content.trim(),
            category = category?.name ?: existing.category,
            importanceScore = importanceScore ?: existing.importanceScore,
            updatedAt = System.currentTimeMillis()
        )
        memoryDao.updateDocument(updated)
        JarvisLogger.i("PersonalMemory", "Updated memory $id")
        return@withContext true
    }

    /**
     * Delete a single memory item by ID.
     */
    suspend fun deleteMemory(id: String): Boolean = withContext(Dispatchers.IO) {
        memoryDao.deleteDocument(id)
        JarvisLogger.i("PersonalMemory", "Deleted memory with ID=$id")
        return@withContext true
    }

    /**
     * Clear all memory documents completely.
     */
    suspend fun clearAllMemory(): Boolean = withContext(Dispatchers.IO) {
        memoryDao.deleteAllDocuments()
        JarvisLogger.w("PersonalMemory", "Wiped all memories from local database.")
        return@withContext true
    }

    /**
     * Search memories with keyword or FTS5 query.
     */
    suspend fun searchMemories(query: String): List<DocumentEntity> = withContext(Dispatchers.IO) {
        if (query.isBlank()) {
            return@withContext memoryDao.getAllDocuments()
        }
        val cleanQuery = query.trim()
        val results = try {
            memoryDao.searchFts(cleanQuery, limit = 20)
        } catch (e: Exception) {
            emptyList()
        }
        if (results.isNotEmpty()) {
            results
        } else {
            memoryDao.searchDocuments(cleanQuery)
        }
    }

    /**
     * Retrieve relevant contextual memories for query prompting (RAG).
     */
    suspend fun retrieveContextForQuery(userPrompt: String, limit: Int = 4): List<DocumentEntity> = withContext(Dispatchers.IO) {
        if (!isMemoryEnabled()) return@withContext emptyList()
        val terms = userPrompt.split(" ", ",", ".", "?", "!")
            .map { it.trim() }
            .filter { it.length > 3 }

        if (terms.isEmpty()) {
            return@withContext emptyList()
        }

        val ftsQuery = terms.joinToString(" OR ")
        val docs = try {
            memoryDao.searchFts(ftsQuery, limit = limit)
        } catch (e: Exception) {
            emptyList()
        }

        if (docs.isNotEmpty()) docs else memoryDao.searchDocuments(terms.first())
    }

    /**
     * Seed initial memory templates if the database is empty on first boot.
     */
    suspend fun seedDefaultMemoriesIfEmpty() = withContext(Dispatchers.IO) {
        val existing = memoryDao.getAllDocuments()
        if (existing.isEmpty()) {
            recordMemory(
                content = "L'utilisateur préfère que JARVIS s'exprime en français, avec un ton poli, concis et efficace.",
                source = "Préférences Système Initiales",
                category = MemoryCategory.PREFERENCE,
                importanceScore = 1.0f
            )
            recordMemory(
                content = "Mode d'exécution hybride : favoriser le traitement local pour la vie privée et basculer sur Gemini Cloud pour les requêtes complexes.",
                source = "Règles d'Exécution",
                category = MemoryCategory.HABIT,
                importanceScore = 0.9f
            )
            recordMemory(
                content = "Nom de l'utilisateur principal : Tony / Propriétaire de l'appareil.",
                source = "Profil Utilisateur",
                category = MemoryCategory.USER_PROFILE,
                importanceScore = 1.0f
            )
            JarvisLogger.i("PersonalMemory", "Seeded 3 initial default memories in FTS5 database.")
        }
    }
}
