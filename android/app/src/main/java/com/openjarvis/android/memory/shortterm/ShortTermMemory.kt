package com.openjarvis.android.memory.shortterm

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ShortTermSnapshot(
    val lastUserQuery: String? = null,
    val lastAssistantResponse: String? = null,
    val lastContactMentioned: String? = null,
    val lastApplicationMentioned: String? = null,
    val activeInFlightAction: String? = null,
    val lastIntentType: String? = null,
    val lastActivityTimestamp: Long = System.currentTimeMillis()
)

/**
 * Tier 1: Volatile, fast-expiring Short-Term Memory for immediate interaction continuity.
 * Retains what just happened (last utterance, last response, in-flight action, mentioned contact).
 */
class ShortTermMemory {

    private val _snapshot = MutableStateFlow(ShortTermSnapshot())
    val snapshot: StateFlow<ShortTermSnapshot> = _snapshot.asStateFlow()

    fun updateInteraction(
        query: String,
        response: String,
        contact: String? = null,
        app: String? = null,
        intent: String? = null,
        inFlightAction: String? = null
    ) {
        val current = _snapshot.value
        _snapshot.value = ShortTermSnapshot(
            lastUserQuery = query,
            lastAssistantResponse = response,
            lastContactMentioned = contact ?: current.lastContactMentioned,
            lastApplicationMentioned = app ?: current.lastApplicationMentioned,
            activeInFlightAction = inFlightAction,
            lastIntentType = intent ?: current.lastIntentType,
            lastActivityTimestamp = System.currentTimeMillis()
        )
    }

    fun setInFlightAction(actionDescription: String?) {
        _snapshot.value = _snapshot.value.copy(
            activeInFlightAction = actionDescription,
            lastActivityTimestamp = System.currentTimeMillis()
        )
    }

    fun setLastContact(contactName: String?) {
        _snapshot.value = _snapshot.value.copy(
            lastContactMentioned = contactName,
            lastActivityTimestamp = System.currentTimeMillis()
        )
    }

    fun setLastApp(appName: String?) {
        _snapshot.value = _snapshot.value.copy(
            lastApplicationMentioned = appName,
            lastActivityTimestamp = System.currentTimeMillis()
        )
    }

    fun isExpired(timeoutMs: Long): Boolean {
        val elapsed = System.currentTimeMillis() - _snapshot.value.lastActivityTimestamp
        return elapsed > timeoutMs
    }

    fun clear() {
        _snapshot.value = ShortTermSnapshot()
    }

    fun getPromptContext(timeoutMs: Long): String? {
        if (isExpired(timeoutMs)) return null
        val s = _snapshot.value
        if (s.lastUserQuery.isNullOrBlank() && s.lastContactMentioned.isNullOrBlank()) return null

        return buildString {
            s.lastContactMentioned?.let { append("- Dernier contact mentionné : $it\n") }
            s.lastApplicationMentioned?.let { append("- Dernière application : $it\n") }
            s.activeInFlightAction?.let { append("- Action en attente : $it\n") }
        }.trimEnd().ifBlank { null }
    }
}
