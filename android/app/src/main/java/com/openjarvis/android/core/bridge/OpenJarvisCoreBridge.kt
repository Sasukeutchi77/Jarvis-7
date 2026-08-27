package com.openjarvis.android.core.bridge

import android.content.Context
import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.config.ExecutionMode
import com.openjarvis.android.core.engine.EngineMessage
import com.openjarvis.android.core.engine.InferenceEngine
import com.openjarvis.android.core.engine.StreamChunk
import com.openjarvis.android.core.engine.cloud.GeminiCloudEngine
import com.openjarvis.android.core.engine.lan.LanOpenJarvisEngine
import com.openjarvis.android.core.events.AgentState
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.core.tools.ToolRegistry
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.storage.database.JarvisDatabase
import com.openjarvis.android.storage.database.entity.MemoryCategory
import com.openjarvis.android.storage.database.entity.TraceEntity
import com.openjarvis.android.storage.memory.PersonalMemoryManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Real Core Bridge coordinating Android OS, Voice/Chat UI, Room FTS5 Memory, Native Tools,
 * and Inference Engines (Gemini Cloud + OpenJarvis LAN/Local).
 */
class OpenJarvisCoreBridge(
    private val context: Context,
    private val configManager: ConfigManager,
    private val secureVault: SecureVault,
    private val database: JarvisDatabase,
    private val memoryManager: PersonalMemoryManager
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _agentState = MutableStateFlow(AgentState.IDLE)
    val agentState: StateFlow<AgentState> = _agentState.asStateFlow()

    private val _lastResponse = MutableStateFlow("")
    val lastResponse: StateFlow<String> = _lastResponse.asStateFlow()

    // Native Tool Registry
    private val toolRegistry = ToolRegistry(context)

    // Engines
    private val geminiEngine = GeminiCloudEngine(secureVault)
    private val lanEngine = LanOpenJarvisEngine(configManager)

    // Conversation history kept in memory for contextual turns
    private val conversationHistory = mutableListOf<EngineMessage>()

    fun initialize() {
        JarvisLogger.i("CoreBridge", "OpenJarvis Android Real Core Bridge initialized with Native Tools, Personal Memory & Dual Engine.")
    }

    /**
     * Entry point for processing user requests from Voice HUD or Chat UI.
     * Implements full real flow:
     * User -> Intent Check (Remember/Recall/Tools) -> Memory Retrieval (FTS5) -> AI Engine (SSE Stream) -> Response -> Android UI & TTS
     */
    fun processQuery(userPrompt: String, onStreamDelta: ((String) -> Unit)? = null) {
        if (userPrompt.isBlank()) return

        scope.launch {
            val startTime = System.currentTimeMillis()
            updateState(AgentState.THINKING)
            JarvisEventBus.emit(JarvisEvent.UserSpeechRecognized(userPrompt, true))

            try {
                val promptLower = userPrompt.lowercase().trim()

                // 1. Direct explicit memory recording commands: e.g. "Rappelle-toi que...", "Mémorise que...", "Souviens-toi de..."
                if (promptLower.startsWith("rappelle-toi que") || promptLower.startsWith("rappelle toi que") ||
                    promptLower.startsWith("souviens-toi que") || promptLower.startsWith("souviens toi que") ||
                    promptLower.startsWith("mémorise que") || promptLower.startsWith("memorise que") ||
                    promptLower.startsWith("garde en mémoire que")
                ) {
                    handleExplicitMemoryCreation(userPrompt, startTime, onStreamDelta)
                    return@launch
                }

                // 2. Quick deterministic native tool triggers (e.g. system info, battery, time)
                if (promptLower.contains("batterie") || promptLower.contains("battery")) {
                    executeNativeToolDirect("get_battery_status", startTime, onStreamDelta)
                    return@launch
                } else if (promptLower.contains("système") || promptLower.contains("appareil") || promptLower.contains("hardware")) {
                    executeNativeToolDirect("get_system_info", startTime, onStreamDelta)
                    return@launch
                }

                // 3. Contextual Memory Retrieval (RAG via SQLite FTS5)
                val relevantDocs = memoryManager.retrieveContextForQuery(userPrompt, limit = 4)

                if (relevantDocs.isNotEmpty()) {
                    JarvisLogger.d("CoreBridge", "Retrieved ${relevantDocs.size} context chunks from FTS5 database.")
                }

                // 4. Select appropriate Engine based on ExecutionMode & Availability
                val executionMode = configManager.config.value.executionMode
                val engine: InferenceEngine = when (executionMode) {
                    ExecutionMode.LOCAL_ONLY -> lanEngine
                    ExecutionMode.CLOUD_ONLY -> geminiEngine
                    ExecutionMode.HYBRID_AUTO -> {
                        if (geminiEngine.isAvailable()) geminiEngine else lanEngine
                    }
                }

                // Append user message to active conversation session
                conversationHistory.add(EngineMessage(role = "user", content = userPrompt))
                if (conversationHistory.size > 10) {
                    conversationHistory.removeAt(0)
                }

                val responseBuilder = StringBuilder()
                var hasError = false
                var totalTokensUsed = 0

                updateState(AgentState.SPEAKING)

                engine.generateStream(
                    messages = conversationHistory,
                    contextMemory = relevantDocs,
                    tools = toolRegistry.getAllTools().map { it.name }
                ).collect { chunk ->
                    when (chunk) {
                        is StreamChunk.TextDelta -> {
                            responseBuilder.append(chunk.text)
                            _lastResponse.value = responseBuilder.toString()
                            onStreamDelta?.invoke(chunk.text)
                            JarvisEventBus.emit(JarvisEvent.ContentStreamChunk(chunk.text))
                        }
                        is StreamChunk.Completed -> {
                            totalTokensUsed = chunk.totalTokens
                        }
                        is StreamChunk.Error -> {
                            hasError = true
                            JarvisLogger.w("CoreBridge", "Inference error: ${chunk.message}")
                            val fallback = "Désolé, je rencontre une difficulté de connexion avec le moteur (${chunk.message}). Vérifiez vos clés API ou votre connexion serveur."
                            responseBuilder.append(fallback)
                            _lastResponse.value = fallback
                            onStreamDelta?.invoke(fallback)
                            JarvisEventBus.emit(JarvisEvent.ContentStreamChunk(fallback))
                        }
                        else -> Unit
                    }
                }

                val finalResponse = responseBuilder.toString()
                if (!hasError && finalResponse.isNotEmpty()) {
                    conversationHistory.add(EngineMessage(role = "assistant", content = finalResponse))
                }

                val durationMs = System.currentTimeMillis() - startTime
                database.memoryDao().insertTrace(
                    TraceEntity(
                        sessionId = "session_${System.currentTimeMillis()}",
                        query = userPrompt,
                        response = finalResponse,
                        executionMode = executionMode.name,
                        modelUsed = engine.modelName,
                        latencyMs = durationMs,
                        tokensPrompt = userPrompt.length / 4,
                        tokensCompletion = totalTokensUsed,
                        toolsUsedJson = "[]",
                        isSuccess = !hasError
                    )
                )

            } catch (e: Exception) {
                JarvisLogger.e("CoreBridge", "Error in processQuery", e)
                val err = "Une erreur système inattendue est survenue : ${e.message}"
                _lastResponse.value = err
                onStreamDelta?.invoke(err)
            } finally {
                updateState(AgentState.IDLE)
            }
        }
    }

    private suspend fun handleExplicitMemoryCreation(
        userPrompt: String,
        startTime: Long,
        onStreamDelta: ((String) -> Unit)?
    ) {
        val memoryFact = userPrompt
            .replaceFirst(Regex("^(rappelle-toi que|rappelle toi que|souviens-toi que|souviens toi que|mémorise que|memorise que|garde en mémoire que)\\s*", RegexOption.IGNORE_CASE), "")
            .trim()

        val doc = memoryManager.recordMemory(
            content = memoryFact,
            source = "Commande Vocale Directe",
            category = MemoryCategory.IMPORTANT_FACT,
            importanceScore = 1.0f
        )

        val confirmMessage = "C'est bien noté Monsieur. J'ai enregistré cette information dans ma mémoire persistante FTS5 sécurisée : \"$memoryFact\"."
        _lastResponse.value = confirmMessage
        onStreamDelta?.invoke(confirmMessage)
        JarvisEventBus.emit(JarvisEvent.ContentStreamChunk(confirmMessage))

        val durationMs = System.currentTimeMillis() - startTime
        database.memoryDao().insertTrace(
            TraceEntity(
                sessionId = "memory_write_${System.currentTimeMillis()}",
                query = userPrompt,
                response = confirmMessage,
                executionMode = "ON_DEVICE_PERSISTENCE",
                modelUsed = "FTS5-Memory-Store",
                latencyMs = durationMs,
                tokensPrompt = 0,
                tokensCompletion = 0,
                toolsUsedJson = "[\"personal_memory_manager\"]",
                isSuccess = true
            )
        )
        updateState(AgentState.IDLE)
    }

    private suspend fun executeNativeToolDirect(
        toolName: String,
        startTime: Long,
        onStreamDelta: ((String) -> Unit)?
    ) {
        updateState(AgentState.EXECUTING_TOOL)
        JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(toolName, "EXECUTING"))

        val result = toolRegistry.executeTool(toolName, "{}")
        val textResponse = if (result.success) {
            "Rapport d'exécution de l'outil matériel [$toolName] :\n${result.output}"
        } else {
            "Échec de l'outil $toolName : ${result.error}"
        }

        _lastResponse.value = textResponse
        onStreamDelta?.invoke(textResponse)
        JarvisEventBus.emit(JarvisEvent.ContentStreamChunk(textResponse))

        val durationMs = System.currentTimeMillis() - startTime
        database.memoryDao().insertTrace(
            TraceEntity(
                sessionId = "tool_session_${System.currentTimeMillis()}",
                query = "Tool Direct: $toolName",
                response = textResponse,
                executionMode = "ON_DEVICE_NATIVE",
                modelUsed = "Android-Native-Tool",
                latencyMs = durationMs,
                tokensPrompt = 0,
                tokensCompletion = 0,
                toolsUsedJson = "[\"$toolName\"]",
                isSuccess = result.success
            )
        )
        updateState(AgentState.IDLE)
    }

    private fun updateState(newState: AgentState) {
        _agentState.value = newState
        JarvisEventBus.emit(JarvisEvent.AgentStateChanged(newState))
    }
}
