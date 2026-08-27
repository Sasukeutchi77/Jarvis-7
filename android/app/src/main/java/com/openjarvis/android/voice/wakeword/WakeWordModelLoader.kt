package com.openjarvis.android.voice.wakeword

import android.content.Context
import com.openjarvis.android.logging.JarvisLogger
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader

/**
 * Real Acoustic Model & Template Loader for JARVIS Wake-Word Engine.
 * Loads and parses acoustic profile models from:
 * 1. Android Assets directory (`assets/models/wakeword/*.json`) -> MODEL_LOADED_ASSET
 * 2. User-trained personalized templates in internal app storage -> MODEL_LOADED_USER_TEMPLATES
 * 3. Compiled baseline acoustic templates as transparent fallback -> MODEL_LOADED_COMPILED_TEMPLATE
 *
 * NOTE: Explicitly designated as Acoustic Template / DTW engine; never falsely claims to be a neural network.
 */
object WakeWordModelLoader {

    private const val USER_TEMPLATES_DIR = "wakeword_user_templates"

    /**
     * Load a WakeWordModel for the requested phrase.
     * Checks user personalized templates first, then asset JSON files, and falls back to compiled baseline.
     */
    fun loadModel(context: Context, phrase: String): WakeWordModel {
        val normalized = phrase.trim().lowercase()
        JarvisLogger.i("WakeWordModelLoader", "WakeWordEngine: MODEL_LOADING -> Searching templates for '$phrase'...")

        // 1. Check for user-trained personalized voice templates
        val userModel = loadUserPersonalizedTemplates(context, phrase)
        if (userModel != null && userModel.templates.isNotEmpty()) {
            JarvisLogger.i("WakeWordModelLoader", "WakeWordEngine: MODEL_LOADED_USER_TEMPLATES -> Loaded ${userModel.templates.size} personalized user templates for '$phrase'")
            return userModel
        }

        // 2. Attempt to load asset model
        val assetFileName = when {
            normalized.contains("dis") -> "models/wakeword/dis_jarvis.json"
            else -> "models/wakeword/hey_jarvis.json"
        }

        try {
            context.assets.open(assetFileName).use { inputStream ->
                val reader = BufferedReader(InputStreamReader(inputStream))
                val jsonString = reader.readText()
                val json = JSONObject(jsonString)

                val id = json.optString("id", "model_hey_jarvis_v2")
                val phraseName = json.optString("phrase", phrase)
                val language = json.optString("language", "en-US / fr-FR")
                val sampleRate = json.optInt("sampleRate", 16000)
                val totalFrames = json.optInt("totalExpectedFrames", 85)

                val statesArray = json.getJSONArray("phoneticStates")
                val phoneticStates = parsePhoneticStates(statesArray)

                if (phoneticStates.isNotEmpty()) {
                    val baseTemplate = WakeWordTemplate(
                        id = "${id}_asset_primary",
                        label = "Asset Standard",
                        phoneticStates = phoneticStates,
                        durationFrames = totalFrames,
                        sampleRate = sampleRate
                    )

                    val loadedModel = WakeWordModel(
                        id = id,
                        phrase = phraseName,
                        language = language,
                        sampleRate = sampleRate,
                        totalExpectedFrames = totalFrames,
                        phoneticStates = phoneticStates,
                        templates = listOf(baseTemplate),
                        sourceType = ModelSourceType.MODEL_LOADED_ASSET
                    )
                    JarvisLogger.i("WakeWordModelLoader", "WakeWordEngine: MODEL_LOADED_ASSET -> Successfully loaded '$assetFileName' (${phoneticStates.size} acoustic states, ${jsonString.length} bytes)")
                    return loadedModel
                }
            }
        } catch (e: Exception) {
            JarvisLogger.w("WakeWordModelLoader", "WakeWordEngine: Asset load '$assetFileName' unavailable: ${e.message}. Using compiled acoustic template fallback.")
        }

        // 3. Compiled template fallback
        val compiledModel = WakeWordModel.getModelForPhrase(phrase)
        JarvisLogger.i("WakeWordModelLoader", "WakeWordEngine: MODEL_LOADED_COMPILED_TEMPLATE -> Using compiled template with ${compiledModel.templates.size} acoustic exemplars")
        return compiledModel
    }

    /**
     * Save user-trained personalized acoustic templates recorded via "Train My Voice".
     */
    fun saveUserPersonalizedTemplate(context: Context, phrase: String, template: WakeWordTemplate): Boolean {
        try {
            val dir = File(context.filesDir, USER_TEMPLATES_DIR)
            if (!dir.exists()) dir.mkdirs()

            val sanitizedPhrase = phrase.trim().lowercase().replace(" ", "_")
            val file = File(dir, "${sanitizedPhrase}_${template.id}.json")

            val json = JSONObject()
            json.put("id", template.id)
            json.put("label", template.label)
            json.put("phrase", phrase)
            json.put("durationFrames", template.durationFrames)
            json.put("sampleRate", template.sampleRate)
            json.put("isUserPersonalized", true)

            val statesArray = JSONArray()
            for (state in template.phoneticStates) {
                val stateObj = JSONObject()
                stateObj.put("name", state.name)
                stateObj.put("weight", state.weight.toDouble())
                stateObj.put("minFrames", state.minFrames)
                stateObj.put("maxFrames", state.maxFrames)
                stateObj.put("minFricativeEnergy", state.minFricativeEnergy.toDouble())
                stateObj.put("minVoicingEnergy", state.minVoicingEnergy.toDouble())

                val mfccArray = JSONArray()
                for (v in state.expectedMfcc) {
                    mfccArray.put(v.toDouble())
                }
                stateObj.put("expectedMfcc", mfccArray)
                statesArray.put(stateObj)
            }
            json.put("phoneticStates", statesArray)

            file.writeText(json.toString())
            JarvisLogger.i("WakeWordModelLoader", "Saved user personalized template '${template.id}' to ${file.absolutePath}")
            return true
        } catch (e: Exception) {
            JarvisLogger.e("WakeWordModelLoader", "Failed to save user personalized template: ${e.message}")
            return false
        }
    }

    /**
     * Load user personalized templates from internal storage if available.
     */
    fun loadUserPersonalizedTemplates(context: Context, phrase: String): WakeWordModel? {
        try {
            val dir = File(context.filesDir, USER_TEMPLATES_DIR)
            if (!dir.exists() || !dir.isDirectory) return null

            val sanitizedPhrase = phrase.trim().lowercase().replace(" ", "_")
            val files = dir.listFiles { f -> f.name.startsWith(sanitizedPhrase) && f.name.endsWith(".json") } ?: return null

            if (files.isEmpty()) return null

            val templates = mutableListOf<WakeWordTemplate>()
            for (file in files) {
                val json = JSONObject(file.readText())
                val id = json.getString("id")
                val label = json.optString("label", "Personalized Template")
                val durationFrames = json.optInt("durationFrames", 85)
                val sampleRate = json.optInt("sampleRate", 16000)
                val states = parsePhoneticStates(json.getJSONArray("phoneticStates"))
                if (states.isNotEmpty()) {
                    templates.add(
                        WakeWordTemplate(
                            id = id,
                            label = label,
                            phoneticStates = states,
                            durationFrames = durationFrames,
                            sampleRate = sampleRate,
                            isUserPersonalized = true
                        )
                    )
                }
            }

            if (templates.isNotEmpty()) {
                val primary = templates.first()
                return WakeWordModel(
                    id = "user_personalized_$sanitizedPhrase",
                    phrase = phrase,
                    language = "user-custom",
                    sampleRate = primary.sampleRate,
                    totalExpectedFrames = primary.durationFrames,
                    phoneticStates = primary.phoneticStates,
                    templates = templates,
                    sourceType = ModelSourceType.MODEL_LOADED_USER_TEMPLATES
                )
            }
        } catch (e: Exception) {
            JarvisLogger.w("WakeWordModelLoader", "Error reading user personalized templates: ${e.message}")
        }
        return null
    }

    /**
     * Clear all user-recorded voice templates.
     */
    fun clearUserPersonalizedTemplates(context: Context): Boolean {
        return try {
            val dir = File(context.filesDir, USER_TEMPLATES_DIR)
            if (dir.exists()) {
                dir.deleteRecursively()
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun parsePhoneticStates(statesArray: JSONArray): List<PhoneticState> {
        val phoneticStates = mutableListOf<PhoneticState>()
        for (i in 0 until statesArray.length()) {
            val stateObj = statesArray.getJSONObject(i)
            val stateName = stateObj.getString("name")
            val mfccArray = stateObj.getJSONArray("expectedMfcc")
            val expectedMfcc = FloatArray(mfccArray.length())
            for (j in 0 until mfccArray.length()) {
                expectedMfcc[j] = mfccArray.getDouble(j).toFloat()
            }

            val weight = stateObj.optDouble("weight", 1.0).toFloat()
            val minFrames = stateObj.optInt("minFrames", 2)
            val maxFrames = stateObj.optInt("maxFrames", 22)
            val minFricative = stateObj.optDouble("minFricativeEnergy", 0.0).toFloat()
            val minVoicing = stateObj.optDouble("minVoicingEnergy", 0.0).toFloat()

            phoneticStates.add(
                PhoneticState(
                    name = stateName,
                    expectedMfcc = expectedMfcc,
                    weight = weight,
                    minFrames = minFrames,
                    maxFrames = maxFrames,
                    minFricativeEnergy = minFricative,
                    minVoicingEnergy = minVoicing
                )
            )
        }
        return phoneticStates
    }
}
