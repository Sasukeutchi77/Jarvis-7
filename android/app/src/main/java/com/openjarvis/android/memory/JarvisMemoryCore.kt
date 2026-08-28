package com.openjarvis.android.memory

import android.content.Context
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.memory.conversation.ConversationMemory
import com.openjarvis.android.memory.longterm.LongTermMemory
import com.openjarvis.android.memory.model.JarvisUserProfile
import com.openjarvis.android.memory.model.MemoryActionResult
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.memory.model.MemoryCommandType
import com.openjarvis.android.memory.model.MemoryConfirmation
import com.openjarvis.android.memory.model.MemoryResultStatus
import com.openjarvis.android.memory.policy.MemoryConfig
import com.openjarvis.android.memory.policy.MemoryPolicy
import com.openjarvis.android.memory.policy.MemorySettings
import com.openjarvis.android.memory.repository.MemoryRepository
import com.openjarvis.android.memory.retriever.MemoryContextBuilder
import com.openjarvis.android.memory.retriever.MemoryRetriever
import com.openjarvis.android.memory.router.MemoryCommandRouter
import com.openjarvis.android.memory.shortterm.ShortTermMemory
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.storage.database.JarvisDatabase
import com.openjarvis.android.storage.database.entity.MemoryEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Central Orchestrator for the JARVIS Memory Core (Step 6).
 * Unifies Short-Term, Conversational, and Long-Term Memory tiers.
 */
class JarvisMemoryCore(
    context: Context,
    val secureVault: SecureVault
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Storage & DAOs
    val database = JarvisDatabase.getInstance(context)
    val memoryDao = database.jarvisMemoryDao()
    val repository = MemoryRepository(memoryDao, secureVault)

    // Configuration & Policies
    val settings = MemorySettings(context)
    val policy = MemoryPolicy(settings)

    // Memory Tiers
    val shortTermMemory = ShortTermMemory()
    val conversationMemory = ConversationMemory()
    val longTermMemory = LongTermMemory(repository, policy)

    // RAG & Context
    val retriever = MemoryRetriever(repository, policy)
    val contextBuilder = MemoryContextBuilder(longTermMemory, shortTermMemory, conversationMemory, retriever, policy)

    // Intent routing
    val commandRouter = MemoryCommandRouter()

    // Confirmation management
    private val _pendingConfirmation = MutableStateFlow<MemoryConfirmation?>(null)
    val pendingConfirmation: StateFlow<MemoryConfirmation?> = _pendingConfirmation.asStateFlow()

    init {
        scope.launch {
            longTermMemory.seedDefaultsIfEmpty()
        }
    }

    /**
     * Tries to execute an explicit memory command (e.g. "retiens que...", "qu'est-ce que tu sais sur moi...").
     * Returns a MemoryActionResult if the command was recognized and handled, or null if it's a general query.
     */
    suspend fun processMemoryCommand(input: String): MemoryActionResult? {
        val parsed = commandRouter.parse(input)
        if (parsed.type == MemoryCommandType.UNKNOWN) {
            return null
        }

        if (!policy.isMemoryAccessible() && parsed.type != MemoryCommandType.MEMORY_STATUS) {
            return MemoryActionResult(
                status = MemoryResultStatus.DISABLED,
                spokenMessage = "Le système de mémoire est actuellement désactivé.",
                actionType = parsed.type
            )
        }

        return when (parsed.type) {
            MemoryCommandType.REMEMBER -> {
                val content = parsed.targetContent ?: input
                val result = longTermMemory.recordMemory(
                    content = content,
                    category = parsed.category,
                    source = "USER_EXPLICIT"
                )

                if (result.isSuccess) {
                    val entity = result.getOrNull()!!
                    MemoryActionResult(
                        status = MemoryResultStatus.SUCCESS,
                        spokenMessage = "Bien noté. J'ai enregistré cette information dans ma mémoire : « ${entity.content} ».",
                        actionType = MemoryCommandType.REMEMBER,
                        item = entity
                    )
                } else {
                    val ex = result.exceptionOrNull()
                    val errorMsg = ex?.message ?: "Impossible d'enregistrer cette information."
                    MemoryActionResult(
                        status = MemoryResultStatus.SECURITY_REJECTED,
                        spokenMessage = errorMsg,
                        actionType = MemoryCommandType.REMEMBER
                    )
                }
            }

            MemoryCommandType.FORGET -> {
                val target = parsed.targetContent ?: ""
                val matches = longTermMemory.findMatchingMemories(target)
                if (matches.isEmpty()) {
                    MemoryActionResult(
                        status = MemoryResultStatus.NOT_FOUND,
                        spokenMessage = "Je n'ai trouvé aucun souvenir correspondant à « $target » dans ma mémoire.",
                        actionType = MemoryCommandType.FORGET
                    )
                } else {
                    val count = matches.size
                    matches.forEach { longTermMemory.forgetMemory(it.id) }
                    MemoryActionResult(
                        status = MemoryResultStatus.SUCCESS,
                        spokenMessage = if (count == 1) "J'ai effacé ce souvenir : « ${matches.first().content} »." else "J'ai supprimé $count souvenirs correspondant à votre demande.",
                        actionType = MemoryCommandType.FORGET,
                        items = matches
                    )
                }
            }

            MemoryCommandType.SHOW_MEMORY, MemoryCommandType.SEARCH_MEMORY -> {
                val memories = if (!parsed.query.isNullOrBlank()) {
                    longTermMemory.findMatchingMemories(parsed.query)
                } else {
                    longTermMemory.getAllMemories()
                }

                if (memories.isEmpty()) {
                    MemoryActionResult(
                        status = MemoryResultStatus.NOT_FOUND,
                        spokenMessage = "Ma mémoire ne contient aucune information pour cette recherche.",
                        actionType = parsed.type
                    )
                } else {
                    val summary = buildString {
                        append("Voici ce que j'ai en mémoire :\n")
                        memories.take(5).forEach { mem ->
                            append("- ${mem.content}\n")
                        }
                        if (memories.size > 5) {
                            append("Et ${memories.size - 5} autre(s) élément(s).")
                        }
                    }
                    MemoryActionResult(
                        status = MemoryResultStatus.SUCCESS,
                        spokenMessage = summary,
                        actionType = parsed.type,
                        items = memories
                    )
                }
            }

            MemoryCommandType.CLEAR_MEMORY -> {
                val confirmId = "confirm_clear_${UUID.randomUUID()}"
                val confirmation = MemoryConfirmation(
                    id = confirmId,
                    prompt = "Cette action effacera irréversiblement toutes les informations mémorisées dans le Memory Core de JARVIS. Voulez-vous continuer ?",
                    actionType = MemoryCommandType.CLEAR_MEMORY,
                    targetDescription = "Effacement complet de la mémoire",
                    executeAction = {
                        longTermMemory.clearAllMemories()
                        shortTermMemory.clear()
                        conversationMemory.clear()
                        _pendingConfirmation.value = null
                        MemoryActionResult(
                            status = MemoryResultStatus.SUCCESS,
                            spokenMessage = "Toutes les mémoires ont été effacées avec succès.",
                            actionType = MemoryCommandType.CLEAR_MEMORY
                        )
                    },
                    onCancel = {
                        _pendingConfirmation.value = null
                    }
                )
                _pendingConfirmation.value = confirmation

                MemoryActionResult(
                    status = MemoryResultStatus.REQUIRES_CONFIRMATION,
                    spokenMessage = confirmation.prompt,
                    actionType = MemoryCommandType.CLEAR_MEMORY
                )
            }

            MemoryCommandType.MEMORY_STATUS -> {
                val count = repository.getAll().size
                val profile = longTermMemory.getUserProfile()
                val statusMsg = "Le Memory Core est actif avec $count souvenir(s) persistant(s) enregistré(s). Profil utilisateur configuré pour ${profile.preferredName ?: "l'utilisateur"} (${profile.preferredLanguage}, format : ${profile.preferredResponseLength.label})."

                MemoryActionResult(
                    status = MemoryResultStatus.SUCCESS,
                    spokenMessage = statusMsg,
                    actionType = MemoryCommandType.MEMORY_STATUS,
                    details = mapOf("count" to count, "profile" to profile)
                )
            }

            MemoryCommandType.EXPLAIN_MEMORY -> {
                val target = parsed.targetContent ?: ""
                val matches = longTermMemory.findMatchingMemories(target)
                val explanation = if (matches.isNotEmpty()) {
                    val mem = matches.first()
                    "Je sais cela car vous me l'avez demandé (${mem.source}). Souvenir enregistré le ${java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.FRANCE).format(java.util.Date(mem.createdAt))} : « ${mem.content} »."
                } else {
                    "Je ne trouve pas cette information spécifique dans mes registres de mémoire."
                }

                MemoryActionResult(
                    status = MemoryResultStatus.SUCCESS,
                    spokenMessage = explanation,
                    actionType = MemoryCommandType.EXPLAIN_MEMORY
                )
            }

            else -> null
        }
    }

    /**
     * Resolves pending confirmation (e.g. for clearing all memories).
     */
    suspend fun handleConfirmation(confirmed: Boolean): MemoryActionResult {
        val current = _pendingConfirmation.value
            ?: return MemoryActionResult(
                status = MemoryResultStatus.CANCELLED,
                spokenMessage = "Aucune action en attente de confirmation.",
                actionType = MemoryCommandType.UNKNOWN
            )

        return if (confirmed) {
            current.executeAction.invoke()
        } else {
            current.onCancel?.invoke()
            _pendingConfirmation.value = null
            MemoryActionResult(
                status = MemoryResultStatus.CANCELLED,
                spokenMessage = "Opération annulée. Vos souvenirs restent intacts.",
                actionType = current.actionType
            )
        }
    }

    /**
     * Ingests a completed query & response into short-term & conversation session memory.
     */
    fun recordTurn(
        query: String,
        response: String,
        contact: String? = null,
        app: String? = null,
        intent: String? = null
    ) {
        val entities = mutableMapOf<String, String>()
        contact?.let { entities["contact"] = it }
        app?.let { entities["app"] = it }

        conversationMemory.recordTurn(
            role = "user",
            content = query,
            intent = intent,
            entities = entities
        )

        conversationMemory.recordTurn(
            role = "assistant",
            content = response,
            intent = intent,
            entities = entities
        )

        shortTermMemory.updateInteraction(
            query = query,
            response = response,
            contact = contact,
            app = app,
            intent = intent
        )
    }

    /**
     * Generates the contextual prompt block for LLM inference.
     */
    suspend fun buildPromptContext(query: String): String {
        return contextBuilder.buildPromptContext(query)
    }

    /**
     * Resolves anaphoric pronouns ("lui", "son numéro", etc.).
     */
    fun resolveEntityReference(utterance: String): String? {
        return conversationMemory.resolveEntityReference(utterance)
    }

    fun observeAllMemories(): Flow<List<MemoryEntity>> = longTermMemory.observeAllMemories()

    fun observeMemoryCount(): Flow<Int> = longTermMemory.observeCount()

    suspend fun getUserProfile(): JarvisUserProfile = longTermMemory.getUserProfile()
}
