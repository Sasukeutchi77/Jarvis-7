package com.openjarvis.android.memory.retriever

import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.memory.policy.MemoryPolicy
import com.openjarvis.android.memory.repository.MemoryRepository
import com.openjarvis.android.storage.database.entity.MemoryEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min

data class ScoredMemory(
    val memory: MemoryEntity,
    val score: Float,
    val matchReasons: List<String>
)

/**
 * Intelligent Local Memory Retriever (RAG Core).
 * Evaluates semantic relevance, recency, category weights, and importance scores
 * to select the most pertinent memories without overloading LLM context windows.
 */
class MemoryRetriever(
    private val repository: MemoryRepository,
    private val policy: MemoryPolicy
) {

    private val STOP_WORDS = setOf(
        "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "et", "ou", "mais",
        "que", "qui", "quoi", "dont", "où", "comment", "pourquoi", "quand", "est", "sont",
        "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "votre", "leur",
        "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "moi", "toi", "lui",
        "jarvis", "bonjour", "salut", "s'il", "te", "plait", "plaît", "merci", "fait", "faire"
    )

    /**
     * Retrieves the most relevant memories for the provided query string.
     */
    suspend fun retrieveRelevantMemories(
        query: String,
        limit: Int = policy.getMaxContextItems(),
        threshold: Float = policy.getRelevanceThreshold()
    ): List<ScoredMemory> = withContext(Dispatchers.IO) {
        if (!policy.isMemoryAccessible() || query.isBlank()) {
            return@withContext emptyList()
        }

        val allMemories = repository.getAll()
        if (allMemories.isEmpty()) {
            return@withContext emptyList()
        }

        val queryTokens = extractSignificantTokens(query)
        val scoredList = mutableListOf<ScoredMemory>()
        val now = System.currentTimeMillis()

        for (mem in allMemories) {
            val contentTokens = extractSignificantTokens(mem.content)
            val matchReasons = mutableListOf<String>()

            // 1. Keyword & Token overlap score (0.0 to 0.5)
            val overlap = queryTokens.intersect(contentTokens).size
            val tokenScore = if (queryTokens.isNotEmpty()) {
                (overlap.toFloat() / queryTokens.size.toFloat()) * 0.5f
            } else 0f

            if (overlap > 0) {
                matchReasons.add("Correspondance de mots-clés ($overlap termes)")
            }

            // 2. Exact Substring match bonus (+0.3)
            var substringScore = 0f
            if (queryTokens.any { it.length > 3 && mem.content.contains(it, ignoreCase = true) }) {
                substringScore = 0.25f
            }

            // 3. Category relevance boost (+0.25)
            val categoryBoost = evaluateCategoryBoost(query, mem.category, matchReasons)

            // 4. Importance multiplier (0.0 to 0.2)
            val importanceScore = (mem.importance.coerceIn(0f, 1f)) * 0.2f

            // 5. Recency boost (up to +0.05 for recent memories within 7 days)
            val ageDays = (now - mem.updatedAt) / (1000 * 60 * 60 * 24f)
            val recencyScore = (max(0f, 7f - ageDays) / 7f) * 0.05f

            // Total composite score
            val totalScore = tokenScore + substringScore + categoryBoost + importanceScore + recencyScore

            if (totalScore >= threshold) {
                scoredList.add(
                    ScoredMemory(
                        memory = mem,
                        score = min(1.0f, totalScore),
                        matchReasons = matchReasons
                    )
                )
            }
        }

        // Sort by composite score descending and limit results
        val topResults = scoredList.sortedByDescending { it.score }.take(limit)
        JarvisLogger.d("MemoryRetriever", "Retrieved ${topResults.size} relevant memories for query: '$query'")
        topResults
    }

    private fun extractSignificantTokens(text: String): Set<String> {
        return text.lowercase()
            .replace("[^a-zA-Z0-9àâäéèêëîïôöùûüç\\s]".toRegex(), " ")
            .split("\\s+".toRegex())
            .filter { it.length >= 3 && it !in STOP_WORDS }
            .toSet()
    }

    private fun evaluateCategoryBoost(
        query: String,
        categoryName: String,
        matchReasons: MutableList<String>
    ): Float {
        val lower = query.lowercase()
        val cat = MemoryCategory.fromString(categoryName)

        return when (cat) {
            MemoryCategory.PROJECT -> {
                if (lower.contains("projet") || lower.contains("jarvis") || lower.contains("application") || lower.contains("code") || lower.contains("développement")) {
                    matchReasons.add("Pertinence catégorie Projet")
                    0.3f
                } else 0f
            }
            MemoryCategory.PREFERENCE -> {
                if (lower.contains("préfère") || lower.contains("préférence") || lower.contains("langue") || lower.contains("réponse") || lower.contains("style")) {
                    matchReasons.add("Pertinence catégorie Préférences")
                    0.3f
                } else 0f
            }
            MemoryCategory.ROUTINE -> {
                if (lower.contains("habitude") || lower.contains("matin") || lower.contains("soir") || lower.contains("routine") || lower.contains("toujours")) {
                    matchReasons.add("Pertinence catégorie Habitudes")
                    0.3f
                } else 0f
            }
            MemoryCategory.PERSONAL_INFO -> {
                if (lower.contains("nom") || lower.contains("appelle") || lower.contains("moi") || lower.contains("âge") || lower.contains("habite")) {
                    matchReasons.add("Pertinence informations personnelles")
                    0.3f
                } else 0f
            }
            MemoryCategory.CONTACT_CONTEXT -> {
                if (lower.contains("contact") || lower.contains("ami") || lower.contains("collègue") || lower.contains("famille") || lower.contains("message")) {
                    matchReasons.add("Pertinence contacts")
                    0.3f
                } else 0f
            }
            else -> 0f
        }
    }
}
