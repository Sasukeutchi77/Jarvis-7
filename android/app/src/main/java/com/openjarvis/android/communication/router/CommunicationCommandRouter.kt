package com.openjarvis.android.communication.router

import com.openjarvis.android.communication.model.CommunicationActionType
import java.text.Normalizer
import java.util.Locale

/**
 * Parsed intent resulting from communication command analysis.
 */
data class ParsedCommunicationIntent(
    val actionType: CommunicationActionType,
    val primaryTarget: String = "",
    val secondaryContent: String = "",
    val appFilter: String = "",
    val isConfirmation: Boolean = false,
    val isCancellation: Boolean = false,
    val isModificationRequest: Boolean = false,
    val isHomonymSelection: Boolean = false,
    val rawUtterance: String = ""
)

/**
 * Intelligent semantic router for parsing natural language communication commands in French & English.
 */
class CommunicationCommandRouter {

    fun parse(utterance: String): ParsedCommunicationIntent {
        val raw = utterance.trim()
        val norm = normalize(raw)

        // 1. Confirmations
        if (isConfirmationPhrase(norm)) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.CONFIRM_SMS,
                isConfirmation = true,
                rawUtterance = raw
            )
        }

        // 2. Cancellations
        if (isCancellationPhrase(norm)) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.CANCEL_SMS,
                isCancellation = true,
                rawUtterance = raw
            )
        }

        // 3. Draft Modification
        if (norm.startsWith("change le message") || norm.startsWith("modifie le message") || 
            norm.startsWith("change le texte") || norm.startsWith("modifie le texte") ||
            norm.startsWith("ecris plutot") || norm.startsWith("remplace par")
        ) {
            val newContent = raw
                .replaceFirst(Regex("^(change le message en|change le message|modifie le message en|modifie le message|change le texte en|change le texte|modifie le texte|écris plutôt|ecris plutot|remplace par)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()

            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.MODIFY_SMS_DRAFT,
                isModificationRequest = true,
                secondaryContent = newContent,
                rawUtterance = raw
            )
        }

        // 4. Homonym / Ordinal Selections
        if (isHomonymSelectionPhrase(norm)) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.RESOLVE_HOMONYM,
                isHomonymSelection = true,
                primaryTarget = raw,
                rawUtterance = raw
            )
        }

        // 5. Next Notification / Next SMS
        if (norm == "lis le suivant" || norm == "message suivant" || norm == "notification suivante" || 
            norm == "suivant" || norm == "lis la suivante" || norm == "passe au suivant" || norm == "next"
        ) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.NEXT_NOTIFICATION,
                rawUtterance = raw
            )
        }

        // 6. Summarize Notifications
        if (norm.contains("resume mes notifications") || norm.contains("fais un resume de mes notifications") ||
            norm.contains("resume des notifications") || norm.contains("resume de mes notifications") ||
            norm.contains("recapitule mes messages")
        ) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.SUMMARIZE_NOTIFICATIONS,
                rawUtterance = raw
            )
        }

        // 7. Contextual / Direct Replies: "réponds-lui : j'arrive dans 10 minutes", "réponds à Paul : d'accord", "réponds au dernier message : ok"
        if (norm.startsWith("reponds") || norm.startsWith("repondre")) {
            val replyParts = extractReplyParts(raw)
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
                primaryTarget = replyParts.first, // Target or empty for contextual sender
                secondaryContent = replyParts.second,
                rawUtterance = raw
            )
        }

        // 8. Specific App Notifications: "quelles sont mes notifications WhatsApp ?", "lis mes notifications telegram"
        if ((norm.contains("notification") || norm.contains("notifications")) && 
            (norm.contains("whatsapp") || norm.contains("telegram") || norm.contains("signal") || norm.contains("messenger") || norm.contains("gmail"))
        ) {
            val app = when {
                norm.contains("whatsapp") -> "WhatsApp"
                norm.contains("telegram") -> "Telegram"
                norm.contains("signal") -> "Signal"
                norm.contains("messenger") -> "Messenger"
                norm.contains("gmail") -> "Gmail"
                else -> ""
            }
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.READ_APP_NOTIFICATIONS,
                appFilter = app,
                rawUtterance = raw
            )
        }

        // 9. All Notifications: "lis mes notifications", "quelles notifications ai-je reçues ?", "ai-je des notifications ?"
        if (norm.contains("lis mes notifications") || norm.contains("quelles notifications") || 
            norm.contains("ai-je des notifications") || norm.contains("ai je des notifications") || 
            norm.contains("est-ce que j'ai des notifications") || norm == "notifications" ||
            norm.contains("mes notifications")
        ) {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.READ_NOTIFICATIONS,
                rawUtterance = raw
            )
        }

        // 10. Read SMS: "lis mes SMS", "lis mon dernier SMS", "ai-je reçu un SMS ?", "ai-je des messages ?"
        if (norm.contains("sms") || (norm.contains("message") && (norm.contains("lis") || norm.contains("recu") || norm.contains("dernier")))) {
            val isLast = norm.contains("dernier") || norm.contains("derniere")
            val contactFilter = extractContactFilterFromSmsQuery(raw)

            return ParsedCommunicationIntent(
                actionType = if (isLast) CommunicationActionType.READ_LAST_SMS else CommunicationActionType.READ_SMS,
                primaryTarget = contactFilter,
                rawUtterance = raw
            )
        }

        // 11. Compose & Send SMS: "écris à Paul : je serai en retard", "envoie un SMS à Marie disant que je suis en route"
        if (norm.startsWith("ecris a") || norm.startsWith("envoie un sms a") || 
            norm.startsWith("envoie un message a") || norm.startsWith("sms a") ||
            norm.startsWith("envoie a")
        ) {
            val parts = extractComposeParts(raw)
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.COMPOSE_SMS,
                primaryTarget = parts.first,
                secondaryContent = parts.second,
                rawUtterance = raw
            )
        }

        // 12. Contact Search & Details: "quel est le numéro de Paul ?", "trouve le contact Marie"
        if (norm.startsWith("quel est le numero de") || norm.startsWith("donne-moi le numero de") || 
            norm.startsWith("donne moi le numero de") || norm.startsWith("trouve le contact") ||
            norm.startsWith("cherche le contact")
        ) {
            val target = raw
                .replaceFirst(Regex("^(quel est le numéro de|quel est le numero de|donne-moi le numéro de|donne moi le numero de|trouve le contact|cherche le contact)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()

            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.GET_CONTACT_PHONE,
                primaryTarget = target,
                rawUtterance = raw
            )
        }

        // 13. Call Contact
        if (norm.startsWith("appelle") || norm.startsWith("appeler") || norm.startsWith("telephone a") || norm.startsWith("compose le numero de")) {
            val target = raw
                .replaceFirst(Regex("^(appelle|appeler|téléphone à|telephone a|compose le numéro de|compose le numero de)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()

            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.CALL_CONTACT,
                primaryTarget = target,
                rawUtterance = raw
            )
        }

        // 14. Clear Context
        if (norm == "efface le contexte" || norm == "oublie le message" || norm == "ferme la discussion") {
            return ParsedCommunicationIntent(
                actionType = CommunicationActionType.CLEAR_CONTEXT,
                rawUtterance = raw
            )
        }

        // Unknown communication intent
        return ParsedCommunicationIntent(
            actionType = CommunicationActionType.UNKNOWN,
            rawUtterance = raw
        )
    }

    private fun extractReplyParts(raw: String): Pair<String, String> {
        // Pattern 1: "réponds à Paul : je serai là"
        if (raw.contains(":")) {
            val parts = raw.split(":", limit = 2)
            val target = parts[0]
                .replaceFirst(Regex("^(réponds à|reponds a|répondre à|repondre a|réponds au dernier message de|reponds au dernier message de)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()
            val text = parts[1].trim()
            return Pair(target, text)
        }

        // Pattern 2: "réponds-lui que j'arrive" or "réponds lui j'arrive"
        val luiMatch = Regex("^(?:réponds-lui|reponds-lui|réponds lui|reponds lui|réponds|reponds)\\s+(?:que|disant|pour dire que)?\\s*(.+)$", RegexOption.IGNORE_CASE).find(raw)
        if (luiMatch != null) {
            val text = luiMatch.groupValues[1].trim()
            return Pair("", text)
        }

        return Pair("", raw)
    }

    private fun extractComposeParts(raw: String): Pair<String, String> {
        // Colon separator: "écris à Paul : je serai en retard"
        if (raw.contains(":")) {
            val parts = raw.split(":", limit = 2)
            val recipient = parts[0]
                .replaceFirst(Regex("^(écris à|ecris a|envoie un sms à|envoie un sms a|envoie un message à|envoie un message a|sms à|sms a|envoie à|envoie a)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()
            val body = parts[1].trim()
            return Pair(recipient, body)
        }

        // Keyword connectors: "disant", "pour dire que", "que"
        val connectorMatch = Regex("^(?:écris à|ecris a|envoie un sms à|envoie un sms a|envoie un message à|envoie un message a|envoie à|envoie a)\\s+(.+?)\\s+(?:disant|pour dire que|avec le texte|que)\\s+(.+)$", RegexOption.IGNORE_CASE).find(raw)
        if (connectorMatch != null) {
            val recipient = connectorMatch.groupValues[1].trim()
            val body = connectorMatch.groupValues[2].trim()
            return Pair(recipient, body)
        }

        // Recipient only
        val recipient = raw
            .replaceFirst(Regex("^(écris à|ecris a|envoie un sms à|envoie un sms a|envoie un message à|envoie un message a|sms à|sms a|envoie à|envoie a)\\s*", RegexOption.IGNORE_CASE), "")
            .trim()
        return Pair(recipient, "")
    }

    private fun extractContactFilterFromSmsQuery(raw: String): String {
        val match = Regex("(?:de|venant de|de la part de)\\s+([a-zA-Z0-9à-üÀ-Ü\\s]+)$", RegexOption.IGNORE_CASE).find(raw)
        return match?.groupValues?.get(1)?.trim() ?: ""
    }

    private fun isConfirmationPhrase(norm: String): Boolean {
        return norm == "oui" || norm == "confirmer" || norm == "confirme" || 
               norm == "vas-y" || norm == "vas y" || norm == "d'accord" || 
               norm == "d accord" || norm == "ok" || norm == "envoie" || 
               norm == "envoie le" || norm == "envoie-le" || norm == "envoie le message" ||
               norm == "appelle" || norm == "valider" || norm == "valide" || 
               norm == "oui confirme" || norm == "oui vas-y" || norm == "oui envoie"
    }

    private fun isCancellationPhrase(norm: String): Boolean {
        return norm == "non" || norm == "annule" || norm == "annuler" || 
               norm == "stop" || norm == "pas maintenant" || norm == "refuse" || 
               norm == "laisse tomber" || norm == "non merci" || norm == "non annule" ||
               norm == "ne l'envoie pas" || norm == "ne l envoie pas"
    }

    private fun isHomonymSelectionPhrase(norm: String): Boolean {
        return norm.startsWith("le premier") || norm == "1" || norm == "le 1" ||
               norm.startsWith("le deuxieme") || norm.startsWith("le second") || norm == "2" || norm == "le 2" ||
               norm.startsWith("le troisieme") || norm == "3" || norm == "le 3" ||
               norm.startsWith("le quatrieme") || norm == "4" || norm == "le 4"
    }

    private fun normalize(str: String): String {
        return Normalizer.normalize(str, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase(Locale.ROOT)
            .trim()
    }
}
