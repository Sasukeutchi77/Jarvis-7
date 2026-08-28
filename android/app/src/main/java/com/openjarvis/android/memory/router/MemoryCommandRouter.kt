package com.openjarvis.android.memory.router

import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.memory.model.MemoryCommandType

data class MemoryParsedCommand(
    val type: MemoryCommandType,
    val rawText: String,
    val targetContent: String? = null,
    val category: MemoryCategory = MemoryCategory.PREFERENCE,
    val query: String? = null,
    val requiresConfirmation: Boolean = false
)

/**
 * Natural language intent parser for JARVIS Memory Core commands.
 */
class MemoryCommandRouter {

    fun parse(input: String): MemoryParsedCommand {
        val trimmed = input.trim()
        val lower = trimmed.lowercase()

        // 1. Clear all memory commands (Requires explicit confirmation!)
        if (lower.contains("oublie tout ce que tu sais") ||
            lower.contains("efface toute ta mémoire") ||
            lower.contains("supprime toute ta mémoire") ||
            lower.contains("efface tous mes souvenirs") ||
            lower.contains("supprime tous mes souvenirs") ||
            lower.contains("réinitialise ta mémoire")
        ) {
            return MemoryParsedCommand(
                type = MemoryCommandType.CLEAR_MEMORY,
                rawText = trimmed,
                requiresConfirmation = true
            )
        }

        // 2. Memory status / count
        if (lower.contains("statut de ta mémoire") ||
            lower.contains("état de ta mémoire") ||
            lower.contains("combien de souvenirs") ||
            lower == "mémoire" || lower == "mémoire jarvis"
        ) {
            return MemoryParsedCommand(
                type = MemoryCommandType.MEMORY_STATUS,
                rawText = trimmed
            )
        }

        // 3. Explain memory source
        if (lower.startsWith("pourquoi sais-tu que") ||
            lower.startsWith("d'où sais-tu que") ||
            lower.startsWith("comment sais-tu que")
        ) {
            val fact = trimmed.replace("(?i)^(pourquoi|d'où|comment)\\s+sais-tu\\s+que\\s*".toRegex(), "").trim()
            return MemoryParsedCommand(
                type = MemoryCommandType.EXPLAIN_MEMORY,
                rawText = trimmed,
                targetContent = fact
            )
        }

        // 4. Forget specific memory
        if (lower.startsWith("oublie que") ||
            lower.startsWith("oublie le fait que") ||
            lower.startsWith("supprime le souvenir") ||
            lower.startsWith("oublie ma préférence") ||
            lower.startsWith("oublie mon projet")
        ) {
            val target = trimmed.replace("(?i)^(oublie\\s+(que|le\\s+fait\\s+que|ma\\s+préférence|mon\\s+projet)?|supprime\\s+le\\s+souvenir\\s*(sur)?)\\s*".toRegex(), "").trim()
            return MemoryParsedCommand(
                type = MemoryCommandType.FORGET,
                rawText = trimmed,
                targetContent = target
            )
        }

        // 5. Show / Search memories
        if (lower.contains("qu'est-ce que tu sais sur moi") ||
            lower.contains("que sais-tu sur moi") ||
            lower.contains("quelles sont mes préférences") ||
            lower.contains("qu'as-tu mémorisé") ||
            lower.contains("qu'est-ce que tu as en mémoire") ||
            lower.startsWith("recherche dans ta mémoire") ||
            lower.startsWith("cherche dans ta mémoire")
        ) {
            val query = if (lower.contains("sur")) {
                trimmed.substringAfterLast("sur").trim().removeSuffix("?").trim()
            } else null

            return MemoryParsedCommand(
                type = if (query.isNullOrBlank()) MemoryCommandType.SHOW_MEMORY else MemoryCommandType.SEARCH_MEMORY,
                rawText = trimmed,
                query = query
            )
        }

        // 6. Explicit Remember commands
        if (lower.startsWith("retiens que") ||
            lower.startsWith("souviens-toi que") ||
            lower.startsWith("n'oublie pas que") ||
            lower.startsWith("garde en mémoire que") ||
            lower.startsWith("garde ça en mémoire :") ||
            lower.startsWith("note que") ||
            lower.startsWith("enregistre que")
        ) {
            val content = trimmed.replace("(?i)^(retiens\\s+que|souviens-toi\\s+que|n'oublie\\s+pas\\s+que|garde\\s+en\\s+mémoire\\s+que|garde\\s+ça\\s+en\\s+mémoire\\s*:?|note\\s+que|enregistre\\s+que)\\s*".toRegex(), "").trim()
            val category = detectCategory(content)
            return MemoryParsedCommand(
                type = MemoryCommandType.REMEMBER,
                rawText = trimmed,
                targetContent = content,
                category = category
            )
        }

        // 7. Identity / Name declarations ("appelle-moi...", "mon nom est...")
        if (lower.startsWith("appelle-moi ") || lower.startsWith("mon nom est ") || lower.startsWith("je m'appelle ")) {
            val name = trimmed.replace("(?i)^(appelle-moi|mon\\s+nom\\s+est|je\\s+m'appelle)\\s*".toRegex(), "").trim()
            return MemoryParsedCommand(
                type = MemoryCommandType.REMEMBER,
                rawText = trimmed,
                targetContent = "L'utilisateur s'appelle $name.",
                category = MemoryCategory.PERSONAL_INFO
            )
        }

        // 8. Preference declarations ("je préfère les réponses courtes", "je préfère...")
        if (lower.startsWith("je préfère ") || lower.startsWith("ma préférence est ")) {
            return MemoryParsedCommand(
                type = MemoryCommandType.REMEMBER,
                rawText = trimmed,
                targetContent = trimmed,
                category = MemoryCategory.PREFERENCE
            )
        }

        return MemoryParsedCommand(
            type = MemoryCommandType.UNKNOWN,
            rawText = trimmed
        )
    }

    private fun detectCategory(content: String): MemoryCategory {
        val lower = content.lowercase()
        return when {
            lower.contains("projet") || lower.contains("application") || lower.contains("développement") -> MemoryCategory.PROJECT
            lower.contains("préfère") || lower.contains("langue") || lower.contains("format") || lower.contains("style") -> MemoryCategory.PREFERENCE
            lower.contains("habitude") || lower.contains("matin") || lower.contains("soir") || lower.contains("routine") -> MemoryCategory.ROUTINE
            lower.contains("nom") || lower.contains("âge") || lower.contains("ville") || lower.contains("contact") -> MemoryCategory.PERSONAL_INFO
            else -> MemoryCategory.CUSTOM
        }
    }
}
