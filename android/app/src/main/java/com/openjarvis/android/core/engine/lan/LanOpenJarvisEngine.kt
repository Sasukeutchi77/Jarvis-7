package com.openjarvis.android.core.engine.lan

import com.openjarvis.android.config.ConfigManager
import com.openjarvis.android.core.engine.EngineMessage
import com.openjarvis.android.core.engine.InferenceEngine
import com.openjarvis.android.core.engine.ProviderType
import com.openjarvis.android.core.engine.StreamChunk
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.database.entity.DocumentEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * Inference Engine that connects to an OpenJarvis or Ollama server running locally or over the LAN.
 * Follows the standard OpenAI /v1/chat/completions SSE streaming protocol.
 */
class LanOpenJarvisEngine(
    private val configManager: ConfigManager,
    override val modelName: String = "qwen2.5:7b"
) : InferenceEngine {

    override val providerType: ProviderType = ProviderType.LAN_OLLAMA

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()

    override suspend fun isAvailable(): Boolean {
        val baseUrl = configManager.getLanServerUrl()
        if (baseUrl.isBlank()) return false
        return try {
            val req = Request.Builder().url("$baseUrl/health").get().build()
            val resp = client.newCall(req).execute()
            resp.isSuccessful
        } catch (e: Exception) {
            false
        }
    }

    override fun generateStream(
        messages: List<EngineMessage>,
        contextMemory: List<DocumentEntity>,
        tools: List<String>
    ): Flow<StreamChunk> = flow {
        val baseUrl = configManager.getLanServerUrl().trimEnd('/')
        if (baseUrl.isBlank()) {
            emit(StreamChunk.Error("Adresse du serveur OpenJarvis LAN non configurée."))
            return@flow
        }

        val url = "$baseUrl/v1/chat/completions"

        // Build messages array
        val msgsArray = JSONArray()

        // System prompt with memory injection
        val systemPrompt = buildString {
            append("Tu es JARVIS, le moteur IA OpenJarvis orchestré sur mobile Android.\n")
            if (contextMemory.isNotEmpty()) {
                append("\n[MÉMOIRE LOCALE / CONTEXTE FTS5] :\n")
                contextMemory.forEach { doc ->
                    append("- [${doc.source}] ${doc.content}\n")
                }
            }
        }
        msgsArray.put(JSONObject().apply {
            put("role", "system")
            put("content", systemPrompt)
        })

        messages.forEach { m ->
            msgsArray.put(JSONObject().apply {
                put("role", m.role)
                put("content", m.content)
            })
        }

        val requestJson = JSONObject().apply {
            put("model", modelName)
            put("messages", msgsArray)
            put("stream", true)
            put("temperature", 0.7)
        }

        val body = requestJson.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                emit(StreamChunk.Error("Erreur serveur LAN: HTTP ${response.code}"))
                return@flow
            }

            val reader = BufferedReader(InputStreamReader(response.body!!.byteStream()))
            var line: String?
            var totalTokens = 0

            while (reader.readLine().also { line = it } != null) {
                val currentLine = line ?: continue
                if (currentLine.startsWith("data: ")) {
                    val data = currentLine.removePrefix("data: ").trim()
                    if (data == "[DONE]") break
                    if (data.isEmpty()) continue

                    try {
                        val json = JSONObject(data)
                        val choices = json.optJSONArray("choices")
                        if (choices != null && choices.length() > 0) {
                            val delta = choices.getJSONObject(0).optJSONObject("delta")
                            val text = delta?.optString("content", "") ?: ""
                            if (text.isNotEmpty()) {
                                totalTokens += Math.max(1, text.length / 4)
                                emit(StreamChunk.TextDelta(text))
                            }
                        }
                    } catch (e: Exception) {
                        JarvisLogger.w("LanEngine", "Error parsing chunk: $currentLine", e)
                    }
                }
            }
            reader.close()
            emit(StreamChunk.Completed(totalTokens = totalTokens, promptTokens = 0, completionTokens = totalTokens))

        } catch (e: Exception) {
            JarvisLogger.e("LanEngine", "Communication failed with LAN OpenJarvis", e)
            emit(StreamChunk.Error("Impossible de joindre le Core OpenJarvis LAN ($baseUrl): ${e.message}", e))
        }
    }.flowOn(Dispatchers.IO)
}
