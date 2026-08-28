package com.openjarvis.android.memory.retriever

import com.openjarvis.android.memory.conversation.ConversationMemory
import com.openjarvis.android.memory.longterm.LongTermMemory
import com.openjarvis.android.memory.policy.MemoryPolicy
import com.openjarvis.android.memory.shortterm.ShortTermMemory

/**
 * Orchestrates and formats structured contextual memory blocks to inject into AI reasoning prompts.
 * Keeps system prompts compact, precise, and highly relevant.
 */
class MemoryContextBuilder(
    private val longTermMemory: LongTermMemory,
    private val shortTermMemory: ShortTermMemory,
    private val conversationMemory: ConversationMemory,
    private val retriever: MemoryRetriever,
    private val policy: MemoryPolicy
) {

    /**
     * Builds a unified memory context string ready for LLM system prompt injection.
     */
    suspend fun buildPromptContext(userPrompt: String): String {
        if (!policy.isMemoryAccessible()) {
            return ""
        }

        val profile = longTermMemory.getUserProfile()
        val scoredMemories = retriever.retrieveRelevantMemories(userPrompt)
        val shortTerm = shortTermMemory.getPromptContext(policy.getShortTermTimeoutMs())
        val convHistory = conversationMemory.formatHistoryForPrompt(maxTurns = 3)

        val hasProfileData = profile.preferredName != null || profile.preferredLanguage.isNotBlank() || profile.customAttributes.isNotEmpty()
        val hasRelevantMemories = scoredMemories.isNotEmpty()
        val hasShortTerm = !shortTerm.isNullOrBlank()
        val hasConvHistory = !convHistory.isNullOrBlank()

        if (!hasProfileData && !hasRelevantMemories && !hasShortTerm && !hasConvHistory) {
            return ""
        }

        return buildString {
            append("\n[CONTEXTE DE MÉMOIRE & PRÉFÉRENCES JARVIS] :\n")

            if (hasProfileData) {
                append("--- Profil & Préférences de l'Utilisateur ---\n")
                append(profile.toPromptSummary())
                append("\n\n")
            }

            if (hasRelevantMemories) {
                append("--- Faits Pertinents Retrouvés en Mémoire ---\n")
                scoredMemories.forEach { scored ->
                    append("- [${scored.memory.category}] : ${scored.memory.content}\n")
                }
                append("\n")
            }

            if (hasShortTerm) {
                append("--- Contexte Immédiat ---\n")
                append(shortTerm)
                append("\n\n")
            }

            if (hasConvHistory) {
                append(convHistory)
                append("\n")
            }

            append("[FIN DU CONTEXTE DE MÉMOIRE]\n")
        }
    }
}
