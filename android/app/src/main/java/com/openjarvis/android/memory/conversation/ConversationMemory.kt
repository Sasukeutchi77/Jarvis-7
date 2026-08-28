package com.openjarvis.android.memory.conversation

import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.memory.model.ConversationTurn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Tier 2: Session-level Conversational Memory across multiple dialogue turns.
 * Retains turn chronology, extracted entities, and provides anaphoric reference resolution ("lui", "ça", "celui-ci").
 * Automatically expires after configurable session inactivity (10–30 mins).
 */
class ConversationMemory {

    private val turns = CopyOnWriteArrayList<ConversationTurn>()

    private val _historyFlow = MutableStateFlow<List<ConversationTurn>>(emptyList())
    val historyFlow: StateFlow<List<ConversationTurn>> = _historyFlow.asStateFlow()

    private var lastActivityTimestamp: Long = System.currentTimeMillis()

    fun recordTurn(
        role: String,
        content: String,
        intent: String? = null,
        entities: Map<String, String> = emptyMap()
    ): ConversationTurn {
        val turn = ConversationTurn(
            role = role,
            content = content.trim(),
            intent = intent,
            entitiesExtracted = entities,
            timestamp = System.currentTimeMillis()
        )
        turns.add(turn)

        // Keep last 20 turns in session memory
        if (turns.size > 20) {
            turns.removeAt(0)
        }

        lastActivityTimestamp = System.currentTimeMillis()
        _historyFlow.value = turns.toList()
        JarvisLogger.d("ConversationMemory", "Recorded turn: role=$role, intent=$intent, entities=${entities.keys}")
        return turn
    }

    /**
     * Attempts to resolve anaphoric pronouns or indirect references ("lui", "son", "sa", "ce contact", "cette app").
     */
    fun resolveEntityReference(utterance: String): String? {
        val lower = utterance.lowercase()

        // 1. Contact / Person references ("lui", "à lui", "son", "sa", "le contact", "ce correspondant")
        val isPersonRef = lower.contains("lui") || lower.contains("à lui") ||
                lower.contains("son numéro") || lower.contains("son message") ||
                lower.contains("ce contact") || lower.contains("rappelle-le") ||
                lower.contains("envoie-lui") || lower.contains("réponds-lui")

        if (isPersonRef) {
            val contact = getLastExtractedEntity("contact") 
                ?: getLastExtractedEntity("targetName")
                ?: getLastExtractedEntity("sender")
            if (contact != null) {
                return contact
            }
        }

        // 2. Application reference ("dans cette app", "cette messagerie")
        val isAppRef = lower.contains("cette app") || lower.contains("cette application") || lower.contains("cette messagerie")
        if (isAppRef) {
            val app = getLastExtractedEntity("app") ?: getLastExtractedEntity("application")
            if (app != null) return app
        }

        // 3. Project reference ("ce projet", "mon projet")
        val isProjectRef = lower.contains("ce projet") || lower.contains("mon projet")
        if (isProjectRef) {
            val proj = getLastExtractedEntity("project")
            if (proj != null) return proj
        }

        return null
    }

    fun getLastExtractedEntity(key: String): String? {
        return turns.asReversed().firstNotNullOfOrNull { turn ->
            turn.entitiesExtracted[key]?.takeIf { it.isNotBlank() }
        }
    }

    fun getRecentTurns(limit: Int = 4): List<ConversationTurn> {
        return turns.takeLast(limit)
    }

    fun isSessionExpired(timeoutMs: Long): Boolean {
        val elapsed = System.currentTimeMillis() - lastActivityTimestamp
        return elapsed > timeoutMs
    }

    fun clearIfExpired(timeoutMs: Long) {
        if (isSessionExpired(timeoutMs) && turns.isNotEmpty()) {
            turns.clear()
            _historyFlow.value = emptyList()
            JarvisLogger.i("ConversationMemory", "Conversational session expired and cleared.")
        }
    }

    fun clear() {
        turns.clear()
        _historyFlow.value = emptyList()
        lastActivityTimestamp = System.currentTimeMillis()
    }

    fun formatHistoryForPrompt(maxTurns: Int = 3): String? {
        val recent = getRecentTurns(maxTurns)
        if (recent.isEmpty()) return null

        return buildString {
            append("[HISTORIQUE DE LA SESSION EN COURS] :\n")
            recent.forEach { turn ->
                val speaker = if (turn.role == "user") "Utilisateur" else "JARVIS"
                append("- $speaker : ${turn.content}\n")
            }
        }.trimEnd()
    }
}
