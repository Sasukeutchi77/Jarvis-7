package com.openjarvis.android.memory.model

/**
 * Structured User Profile synthesized from active Long-Term Memories.
 * Injected selectively into AI reasoning prompts for personalized interaction.
 */
data class JarvisUserProfile(
    val preferredName: String? = null,
    val preferredLanguage: String = "Français",
    val preferredResponseLength: ResponseLength = ResponseLength.SHORT,
    val preferredVoice: String? = null,
    val preferredStyle: String? = "Poli, concis, proactif et courtois",
    val preferredUnits: String = "Métrique (°C, km)",
    val customAttributes: Map<String, String> = emptyMap()
) {
    fun toPromptSummary(): String {
        return buildString {
            preferredName?.let { append("- Nom de l'utilisateur : $it\n") }
            append("- Langue préférée : $preferredLanguage\n")
            append("- Format de réponse souhaité : ${preferredResponseLength.label}\n")
            preferredVoice?.let { append("- Voix préférée : $it\n") }
            preferredStyle?.let { append("- Style d'expression : $it\n") }
            append("- Unités de mesure : $preferredUnits\n")
            customAttributes.forEach { (k, v) ->
                append("- $k : $v\n")
            }
        }.trimEnd()
    }
}
