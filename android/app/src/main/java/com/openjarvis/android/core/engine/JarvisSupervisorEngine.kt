package com.openjarvis.android.core.engine

import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * JARVIS Supervisor Engine for Android Native Core.
 * Bridges local intent dispatching with the central AI Router and 12 Specialized Agents.
 */
enum class SpecializedAgentType(val id: String, val displayName: String) {
    SUPERVISOR("supervisor", "Supervisor Agent"),
    VOICE("voice", "Voice Agent"),
    VISION("vision", "Vision Agent"),
    ANDROID("android", "Android Agent"),
    COMMUNICATION("communication", "Communication Agent"),
    RESEARCH("research", "Web & Research Agent"),
    CODING("coding", "Coding Agent"),
    PHONE("phone", "Phone Agent"),
    CALENDAR("calendar", "Calendar Agent"),
    MEDIA("media", "Media Agent"),
    SECURITY("security", "Security Agent"),
    MEMORY("memory", "Memory Agent"),
    GENERAL_AI("general_ai", "General AI Agent");

    companion object {
        fun fromId(id: String): SpecializedAgentType {
            return entries.find { it.id.equals(id, ignoreCase = true) } ?: GENERAL_AI
        }
    }
}

data class SupervisorRoutingDecision(
    val primaryAgent: SpecializedAgentType,
    val confidence: Float,
    val intent: String,
    val reasoning: String,
    val isMultiStep: Boolean = false
)

data class SupervisorExecutionResult(
    val agent: SpecializedAgentType,
    val success: Boolean,
    val reply: String,
    val spokenSummary: String,
    val latencyMs: Long,
    val providerUsed: String
)

class JarvisSupervisorEngine {

    companion object {
        private const val TAG = "JarvisSupervisor"
        val instance by lazy { JarvisSupervisorEngine() }
    }

    /**
     * Local fast semantic intent router for on-device operations
     */
    fun routeLocalIntent(query: String): SupervisorRoutingDecision {
        val q = query.lowercase().trim()
        JarvisLogger.d(TAG, "Routing query: $q")

        return when {
            // Android Hardware & System
            q.contains("lampe") || q.contains("torche") || q.contains("vibre") ||
            q.contains("batterie") || q.contains("wifi") || q.contains("bluetooth") ||
            q.contains("verrouille") || q.startsWith("ouvre ") || q.startsWith("lance ") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.ANDROID,
                    confidence = 0.95f,
                    intent = "android_hardware_action",
                    reasoning = "Android hardware or app launch intent detected"
                )
            }
            // Communication & Messages
            q.contains("message") || q.contains("sms") || q.contains("whatsapp") ||
            q.contains("telegram") || q.contains("signal") || q.contains("réponds à") ||
            q.contains("lis mes messages") || q.contains("écris à") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.COMMUNICATION,
                    confidence = 0.94f,
                    intent = "communication_message_action",
                    reasoning = "Messaging or notification intent detected"
                )
            }
            // Phone Calls
            q.contains("appelle") || q.contains("téléphone à") || q.contains("compose le numéro") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.PHONE,
                    confidence = 0.96f,
                    intent = "telephony_call_action",
                    reasoning = "Phone call intent detected"
                )
            }
            // Web & Research
            q.contains("cherche sur le web") || q.contains("actualité") || q.contains("météo") ||
            q.contains("qui a gagné") || q.contains("recherche") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.RESEARCH,
                    confidence = 0.92f,
                    intent = "web_research_action",
                    reasoning = "Live information or web search intent"
                )
            }
            // Vision
            q.contains("regarde") || q.contains("photo") || q.contains("image") ||
            q.contains("ocr") || q.contains("scan") || q.contains("capture") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.VISION,
                    confidence = 0.93f,
                    intent = "vision_analysis_action",
                    reasoning = "Visual or image inspection intent"
                )
            }
            // Coding
            q.contains("code") || q.contains("typescript") || q.contains("python") ||
            q.contains("kotlin") || q.contains("fonction") || q.contains("bug") || q.contains("debug") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.CODING,
                    confidence = 0.95f,
                    intent = "coding_architecture_action",
                    reasoning = "Programming or syntax analysis intent"
                )
            }
            // Calendar & Scheduling
            q.contains("rappelle-moi") || q.contains("agenda") || q.contains("planning") ||
            q.contains("rendez-vous") || q.contains("dans 10 minutes") || q.contains("demain à") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.CALENDAR,
                    confidence = 0.94f,
                    intent = "calendar_scheduling_action",
                    reasoning = "Calendar or reminder intent"
                )
            }
            // Media & Music
            q.contains("musique") || q.contains("spotify") || q.contains("chanson") ||
            q.contains("joue") || q.contains("pause la musique") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.MEDIA,
                    confidence = 0.94f,
                    intent = "media_playback_action",
                    reasoning = "Media playback intent"
                )
            }
            // Voice Persona & Settings
            q.contains("change de voix") || q.contains("parle plus fort") || q.contains("lis à haute voix") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.VOICE,
                    confidence = 0.90f,
                    intent = "voice_persona_action",
                    reasoning = "Voice synthesizer configuration intent"
                )
            }
            // Security
            q.contains("sécurité") || q.contains("lockdown") || q.contains("audit") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.SECURITY,
                    confidence = 0.96f,
                    intent = "security_governance_action",
                    reasoning = "Security protocol intent"
                )
            }
            // Memory
            q.contains("souviens-toi") || q.contains("mémorise") || q.contains("que sais-tu") -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.MEMORY,
                    confidence = 0.95f,
                    intent = "memory_knowledge_action",
                    reasoning = "Memory graph storage or recall intent"
                )
            }
            // Default
            else -> {
                SupervisorRoutingDecision(
                    primaryAgent = SpecializedAgentType.GENERAL_AI,
                    confidence = 0.80f,
                    intent = "general_dialogue",
                    reasoning = "General conversational AI routing"
                )
            }
        }
    }
}
