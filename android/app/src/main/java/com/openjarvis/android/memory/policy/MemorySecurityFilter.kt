package com.openjarvis.android.memory.policy

import java.util.regex.Pattern

data class SecurityCheckResult(
    val isAllowed: Boolean,
    val reason: String? = null
)

/**
 * Strict Security and Privacy Filter for JARVIS Memory Core (Step 6).
 * Automatically intercepts and REFUSES to store secrets, API keys, passwords,
 * banking credentials, PINs, or sensitive authentication tokens in memory.
 */
object MemorySecurityFilter {

    private val FORBIDDEN_KEY_PATTERNS = listOf(
        Pattern.compile("(?i)(OPENROUTER|GEMINI|GROQ|DEEPGRAM|TAVILY|OPENWEATHER|GITHUB|SPOTIFY|CLAUDE|OPENAI|ANTHROPIC|AWS|FIREBASE)[_\\-\\s]*(API|KEY|TOKEN|SECRET)"),
        Pattern.compile("(?i)(API[_\\-\\s]*KEY|CLIENT[_\\-\\s]*SECRET|ACCESS[_\\-\\s]*TOKEN|BEARER[_\\-\\s]+[A-Za-z0-9_\\-\\.]+)"),
        Pattern.compile("(?i)(MOT\\s+DE\\s+PASSE|PASSWORD|PASSCODE|CODE\\s+PIN|SECRET\\s+CODE)\\s*[:=]?\\s*\\S+"),
        Pattern.compile("(?i)(NUM[EÉ]RO\\s+DE\\s+CARTE|CARTE\\s+BANCAIRE|CREDIT\\s+CARD|IBAN|CVV|CVC)\\s*[:=]?\\s*\\S+"),
        Pattern.compile("\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\\b"), // Credit cards
        Pattern.compile("\\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\\b"), // IBAN
        Pattern.compile("\\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|gsk_[a-zA-Z0-9]{20,})\\b") // Known token formats
    )

    /**
     * Checks if content is safe to store in persistent memory.
     */
    fun evaluate(content: String): SecurityCheckResult {
        if (content.isBlank()) {
            return SecurityCheckResult(false, "Le contenu est vide.")
        }

        for (pattern in FORBIDDEN_KEY_PATTERNS) {
            val matcher = pattern.matcher(content)
            if (matcher.find()) {
                return SecurityCheckResult(
                    isAllowed = false,
                    reason = "Pour votre sécurité, JARVIS ne peut pas enregistrer de mot de passe, de clé d'API, de code secret ou de coordonnée bancaire dans sa mémoire."
                )
            }
        }

        return SecurityCheckResult(isAllowed = true)
    }
}
