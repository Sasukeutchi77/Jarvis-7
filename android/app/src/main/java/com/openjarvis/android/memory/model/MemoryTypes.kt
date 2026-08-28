package com.openjarvis.android.memory.model

/**
 * Three distinct architectural tiers of the JARVIS Memory Core (Step 6).
 */
enum class MemoryType {
    /**
     * Immediate volatile interaction context: last command, last response, in-flight action.
     * Expiration: 1–5 minutes.
     */
    SHORT_TERM,

    /**
     * Session-level conversational context: multi-turn dialogue, referenced entities, anaphoric resolution.
     * Expiration: 10–30 minutes of inactivity.
     */
    CONVERSATION,

    /**
     * Durable, persistent, structured user preferences, routines, projects, and personal knowledge.
     * Stored in Room database with FTS5 indexing.
     */
    LONG_TERM
}

/**
 * Standardized semantic classification categories for JARVIS Long-Term Memories.
 */
enum class MemoryCategory(val displayName: String, val frenchLabel: String) {
    PREFERENCE("Preference", "Préférence"),
    PERSONAL_INFO("Personal Info", "Information Personnelle"),
    ROUTINE("Routine & Habits", "Habitudes & Routines"),
    PROJECT("Project", "Projet & Tâches"),
    CONTACT_CONTEXT("Contact Context", "Interlocuteurs & Contacts"),
    DEVICE_PREFERENCE("Device Preference", "Préférence Appareil"),
    CONVERSATION_CONTEXT("Conversation Context", "Contexte de Discussion"),
    CUSTOM("Custom Knowledge", "Autre Connaissance");

    companion object {
        fun fromString(value: String): MemoryCategory {
            return entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: CUSTOM
        }
    }
}

/**
 * User preference for length of verbal and textual responses.
 */
enum class ResponseLength(val label: String) {
    SHORT("Courtes et concises"),
    NORMAL("Standard et équilibrées"),
    DETAILED("Détaillées et approfondies");

    companion object {
        fun fromString(value: String?): ResponseLength {
            if (value == null) return NORMAL
            val v = value.lowercase()
            return when {
                v.contains("court") || v.contains("short") || v.contains("bref") || v.contains("concis") -> SHORT
                v.contains("détaill") || v.contains("long") || v.contains("approfondi") -> DETAILED
                else -> NORMAL
            }
        }
    }
}
