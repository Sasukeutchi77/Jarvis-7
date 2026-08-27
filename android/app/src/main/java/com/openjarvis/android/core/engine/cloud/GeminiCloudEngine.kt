package com.openjarvis.android.core.engine.cloud

import com.openjarvis.android.core.engine.EngineMessage
import com.openjarvis.android.core.engine.InferenceEngine
import com.openjarvis.android.core.engine.ProviderType
import com.openjarvis.android.core.engine.StreamChunk
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.storage.SecureVault
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
 * Cloud Engine implementation for Google Gemini API (v1beta generateContentStream).
 */
class GeminiCloudEngine(
    private val secureVault: SecureVault,
    override val modelName: String = "gemini-2.5-flash"
) : InferenceEngine {

    override val providerType: ProviderType = ProviderType.CLOUD_GEMINI

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun isAvailable(): Boolean {
        val key = secureVault.getSecret(SecureVault.KEY_GEMINI)
        return key.isNotBlank()
    }

    override fun generateStream(
        messages: List<EngineMessage>,
        contextMemory: List<DocumentEntity>,
        tools: List<String>
    ): Flow<StreamChunk> = flow {
        val apiKey = secureVault.getSecret(SecureVault.KEY_GEMINI)
        if (apiKey.isBlank()) {
            emit(StreamChunk.Error("Google Gemini API Key manquante dans le SecureVault."))
            return@flow
        }

        val url = "https://generativelanguage.googleapis.com/v1beta/models/$modelName:streamGenerateContent?alt=sse&key=$apiKey"

        val contentsArray = JSONArray()

        // Inject System Persona & Context Memory
        val systemInstruction = buildString {
            append("Tu es JARVIS, l'assistant personnel hautement intelligent et bienveillant de l'utilisateur sur Android. ")
            append("Sois concis, pragmatique et élégant dans tes réponses.\n")
            if (contextMemory.isNotEmpty()) {
                append("\n[CONTEXTE DE MÉMOIRE EXTRAIT] :\n")
                contextMemory.forEach { doc ->
                    append("- (Source: ${doc.source}) ${doc.content}\n")
                }
            }
        }

        // Format Gemini Request Body
        val requestJson = JSONObject().apply {
            put("system_instruction", JSONObject().apply {
                put("parts", JSONArray().put(JSONObject().put("text", systemInstruction)))
            })

            messages.forEach { msg ->
                val geminiRole = if (msg.role == "assistant") "model" else "user"
                contentsArray.put(JSONObject().apply {
                    put("role", geminiRole)
                    put("parts", JSONArray().put(JSONObject().put("text", msg.content)))
                })
            }
            put("contents", contentsArray)

            put("generationConfig", JSONObject().apply {
                put("temperature", 0.7)
                put("maxOutputTokens", 2048)
            })
        }

        val body = requestJson.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(url)
            .post(body)
            .build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                val errBody = response.body?.string() ?: "Code ${response.code}"
                JarvisLogger.e("GeminiEngine", "HTTP Error $errBody")
                emit(StreamChunk.Error("Erreur Gemini Cloud: HTTP ${response.code}"))
                return@flow
            }

            val reader = BufferedReader(InputStreamReader(response.body!!.byteStream()))
            var line: String?
            var totalTokens = 0

            while (reader.readLine().also { line = it } != null) {
                val currentLine = line ?: continue
                if (currentLine.startsWith("data: ")) {
                    val dataJson = currentLine.removePrefix("data: ").trim()
                    if (dataJson.isEmpty()) continue

                    try {
                        val json = JSONObject(dataJson)
                        val candidates = json.optJSONArray("candidates")
                        if (candidates != null && candidates.length() > 0) {
                            val candidate = candidates.getJSONObject(0)
                            val content = candidate.optJSONObject("content")
                            val parts = content?.optJSONArray("parts")
                            if (parts != null && parts.length() > 0) {
                                val text = parts.getJSONObject(0).optString("text", "")
                                if (text.isNotEmpty()) {
                                    totalTokens += Math.max(1, text.length / 4)
                                    emit(StreamChunk.TextDelta(text))
                                }
                            }
                        }
                    } catch (e: Exception) {
                        JarvisLogger.w("GeminiEngine", "Failed to parse SSE line: $currentLine", e)
                    }
                }
            }
            reader.close()
            emit(StreamChunk.Completed(totalTokens = totalTokens, promptTokens = 0, completionTokens = totalTokens))

        } catch (e: Exception) {
            JarvisLogger.e("GeminiEngine", "Connection error to Gemini", e)
            emit(StreamChunk.Error("Impossible de contacter le serveur Gemini: ${e.message}", e))
        }
    }.flowOn(Dispatchers.IO)
}
