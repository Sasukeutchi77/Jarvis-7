package com.openjarvis.android.memory.longterm

import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.memory.model.JarvisUserProfile
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.memory.model.MemoryType
import com.openjarvis.android.memory.model.ResponseLength
import com.openjarvis.android.memory.policy.MemoryPolicy
import com.openjarvis.android.memory.policy.MemorySecurityFilter
import com.openjarvis.android.memory.policy.SecurityCheckResult
import com.openjarvis.android.memory.repository.MemoryRepository
import com.openjarvis.android.storage.database.entity.MemoryEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Tier 3: Durable, Structured Long-Term Memory stored in local SQLite/Room.
 * Handles automatic conflict replacement, semantic categorization, and synthesized User Profiles.
 */
class LongTermMemory(
    private val repository: MemoryRepository,
    private val policy: MemoryPolicy
) {

    /**
     * Records or updates a long-term memory.
     * Automatically resolves conflicts if a dedupKey exists (e.g. "pref_language", "pref_response_length", "user_preferred_name").
     */
    suspend fun recordMemory(
        content: String,
        category: MemoryCategory = MemoryCategory.PREFERENCE,
        source: String = "USER_EXPLICIT",
        importance: Float = 1.0f,
        dedupKey: String? = null,
        expiresAt: Long? = null,
        isEncrypted: Boolean = false
    ): Result<MemoryEntity> = withContext(Dispatchers.IO) {
        if (!policy.canStoreLongTermMemory()) {
            return@withContext Result.failure(IllegalStateException("Le stockage de mémoire long terme est désactivé ou en mode privé."))
        }

        // Security check
        val secCheck = MemorySecurityFilter.evaluate(content)
        if (!secCheck.isAllowed) {
            return@withContext Result.failure(SecurityException(secCheck.reason ?: "Contenu non autorisé."))
        }

        // Detect or refine dedupKey & category automatically
        val resolvedKey = dedupKey ?: detectDedupKey(content, category)
        val resolvedCategory = if (category == MemoryCategory.CUSTOM) detectCategory(content) else category

        // If duplicate key exists, update the existing entity rather than creating a conflict!
        if (resolvedKey != null) {
            val existing = repository.getByKey(resolvedKey)
            if (existing != null) {
                val updated = existing.copy(
                    content = content.trim(),
                    category = resolvedCategory.name,
                    importance = importance,
                    source = source,
                    updatedAt = System.currentTimeMillis(),
                    expiresAt = expiresAt,
                    isEncrypted = isEncrypted
                )
                repository.insertOrUpdate(updated)
                JarvisLogger.i("LongTermMemory", "Updated existing memory key=$resolvedKey with new value: '${updated.content}'")
                return@withContext Result.success(updated)
            }
        }

        val newEntity = MemoryEntity(
            id = "mem_${UUID.randomUUID()}",
            type = MemoryType.LONG_TERM.name,
            category = resolvedCategory.name,
            content = content.trim(),
            importance = importance,
            source = source,
            dedupKey = resolvedKey,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            expiresAt = expiresAt,
            isEncrypted = isEncrypted,
            enabled = true
        )

        repository.insertOrUpdate(newEntity)
        JarvisLogger.i("LongTermMemory", "Recorded new memory id=${newEntity.id}, cat=${resolvedCategory.name}, key=$resolvedKey")
        Result.success(newEntity)
    }

    suspend fun updateMemoryContent(id: String, newContent: String): Boolean = withContext(Dispatchers.IO) {
        val existing = repository.getById(id) ?: return@withContext false
        val secCheck = MemorySecurityFilter.evaluate(newContent)
        if (!secCheck.isAllowed) return@withContext false

        val updated = existing.copy(
            content = newContent.trim(),
            updatedAt = System.currentTimeMillis()
        )
        repository.insertOrUpdate(updated)
        return@withContext true
    }

    suspend fun forgetMemory(id: String): Boolean = withContext(Dispatchers.IO) {
        repository.deleteById(id)
        true
    }

    suspend fun forgetByKey(dedupKey: String): Boolean = withContext(Dispatchers.IO) {
        repository.deleteByKey(dedupKey)
        true
    }

    suspend fun findMatchingMemories(query: String): List<MemoryEntity> = withContext(Dispatchers.IO) {
        if (query.isBlank()) return@withContext repository.getAll()

        val ftsResults = repository.searchFts(query, limit = 10)
        if (ftsResults.isNotEmpty()) {
            return@withContext ftsResults
        }
        repository.searchLike(query, limit = 10)
    }

    suspend fun getAllMemories(): List<MemoryEntity> = withContext(Dispatchers.IO) {
        repository.getAll()
    }

    suspend fun getMemoriesByCategory(category: MemoryCategory): List<MemoryEntity> = withContext(Dispatchers.IO) {
        repository.getByCategory(category)
    }

    fun observeAllMemories(): Flow<List<MemoryEntity>> = repository.observeAll()

    fun observeCount(): Flow<Int> = repository.observeCount()

    suspend fun clearAllMemories(): Boolean = withContext(Dispatchers.IO) {
        repository.clearAll()
        true
    }

    /**
     * Synthesizes the active JarvisUserProfile from stored preference memories.
     */
    suspend fun getUserProfile(): JarvisUserProfile = withContext(Dispatchers.IO) {
        val all = repository.getAll()

        var name: String? = null
        var lang = "Français"
        var respLength = ResponseLength.SHORT
        var voice: String? = null
        val customMap = mutableMapOf<String, String>()

        all.forEach { mem ->
            val key = mem.dedupKey ?: ""
            val content = mem.content.lowercase()

            when {
                key == "user_preferred_name" || content.contains("appelle-moi") || content.contains("mon nom est") -> {
                    name = mem.content.replace("(?i)appelle-moi|mon nom est|je m'appelle|l'utilisateur s'appelle|nom de l'utilisateur :?".toRegex(), "").trim()
                }
                key == "pref_language" || content.contains("langue préférée") || content.contains("parle en") -> {
                    lang = if (content.contains("anglais") || content.contains("english")) "Anglais" else "Français"
                }
                key == "pref_response_length" || content.contains("réponse courte") || content.contains("réponses courtes") -> {
                    respLength = ResponseLength.fromString(mem.content)
                }
                key == "pref_voice" -> {
                    voice = mem.content
                }
                mem.category == MemoryCategory.PREFERENCE.name -> {
                    customMap[mem.id] = mem.content
                }
            }
        }

        JarvisUserProfile(
            preferredName = name,
            preferredLanguage = lang,
            preferredResponseLength = respLength,
            preferredVoice = voice,
            customAttributes = customMap
        )
    }

    /**
     * Automatic heuristic key detection to prevent contradictory memory accumulation.
     */
    private fun detectDedupKey(content: String, category: MemoryCategory): String? {
        val lower = content.lowercase()
        return when {
            lower.contains("appelle-moi") || lower.contains("mon nom est") || lower.contains("je m'appelle") -> "user_preferred_name"
            lower.contains("langue") || lower.contains("parle en anglais") || lower.contains("parle en français") -> "pref_language"
            lower.contains("réponse courte") || lower.contains("réponses courtes") || lower.contains("réponses détaillées") || lower.contains("format de réponse") -> "pref_response_length"
            lower.contains("projet principal") || lower.contains("mon projet s'appelle") -> "project_main_name"
            lower.contains("voix préférée") || lower.contains("voix de jarvis") -> "pref_voice"
            category == MemoryCategory.DEVICE_PREFERENCE -> "pref_device_${content.hashCode()}"
            else -> null
        }
    }

    private fun detectCategory(content: String): MemoryCategory {
        val lower = content.lowercase()
        return when {
            lower.contains("projet") || lower.contains("code") || lower.contains("applet") || lower.contains("tâche") -> MemoryCategory.PROJECT
            lower.contains("habitude") || lower.contains("tous les jours") || lower.contains("chaque matin") || lower.contains("routine") -> MemoryCategory.ROUTINE
            lower.contains("nom") || lower.contains("âge") || lower.contains("anniversaire") || lower.contains("ville") || lower.contains("habite") -> MemoryCategory.PERSONAL_INFO
            lower.contains("préfère") || lower.contains("aime") || lower.contains("ador") || lower.contains("souhaite") -> MemoryCategory.PREFERENCE
            else -> MemoryCategory.CUSTOM
        }
    }

    suspend fun seedDefaultsIfEmpty() = withContext(Dispatchers.IO) {
        val count = repository.getAll().size
        if (count == 0) {
            recordMemory(
                content = "L'utilisateur préfère les réponses courtes, précises et directes.",
                category = MemoryCategory.PREFERENCE,
                source = "SYSTEM_DEFAULT",
                importance = 1.0f,
                dedupKey = "pref_response_length"
            )
            recordMemory(
                content = "Langue d'interaction par défaut : Français.",
                category = MemoryCategory.PREFERENCE,
                source = "SYSTEM_DEFAULT",
                importance = 1.0f,
                dedupKey = "pref_language"
            )
            recordMemory(
                content = "Le projet principal de l'utilisateur s'appelle JARVIS-7 (Assistant Android Vocal & Holographique).",
                category = MemoryCategory.PROJECT,
                source = "SYSTEM_DEFAULT",
                importance = 0.9f,
                dedupKey = "project_main_name"
            )
            JarvisLogger.i("LongTermMemory", "Seeded 3 foundational long term memories.")
        }
    }
}
