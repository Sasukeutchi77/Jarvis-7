package com.openjarvis.android.device

import com.openjarvis.android.device.model.ActionSecurityLevel
import com.openjarvis.android.device.model.DeviceActionType
import java.text.Normalizer
import java.util.Locale

data class ParsedCommandIntent(
    val actionType: DeviceActionType,
    val securityLevel: ActionSecurityLevel,
    val primaryParam: String = "",
    val secondaryParam: String = "",
    val numericValue: Int? = null,
    val booleanFlag: Boolean? = null,
    val isConfirmationResponse: Boolean = false,
    val isCancellationResponse: Boolean = false
)

/**
 * Intelligent Natural Language & Semantic Intent Router for Android Device Operations.
 * Parses user utterances in French/English into deterministic device control commands.
 */
class JarvisCommandRouter {

    fun parse(userUtterance: String): ParsedCommandIntent {
        val raw = userUtterance.trim()
        val normalized = normalize(raw)

        // 1. Check for quick confirmation / cancellation replies to pending sensitive actions
        if (isConfirmationPhrase(normalized)) {
            return ParsedCommandIntent(
                actionType = DeviceActionType.UNKNOWN,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                isConfirmationResponse = true
            )
        }

        if (isCancellationPhrase(normalized)) {
            return ParsedCommandIntent(
                actionType = DeviceActionType.UNKNOWN,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                isCancellationResponse = true
            )
        }

        // 2. Battery / Charging status
        if (normalized.contains("combien de batterie") || 
            normalized.contains("niveau de batterie") || 
            normalized.contains("pourcentage batterie") || 
            normalized.contains("etat de la batterie") || 
            normalized.contains("batterie restante") || 
            normalized.contains("en train de charger") || 
            normalized.contains("charge de la batterie") ||
            normalized.contains("combien me reste t il de batterie") ||
            normalized.contains("combien me reste-t-il de batterie") ||
            (normalized.contains("batterie") && (normalized.contains("reste") || normalized.contains("niveau") || normalized.contains("etat")))
        ) {
            return ParsedCommandIntent(
                actionType = DeviceActionType.BATTERY,
                securityLevel = ActionSecurityLevel.SAFE_ACTION
            )
        }

        // 3. Flashlight / Torch
        if (normalized.contains("lampe") || normalized.contains("torche") || (normalized.contains("flash") && !normalized.contains("flash info"))) {
            val isOff = normalized.contains("eteins") || normalized.contains("desactive") || normalized.contains("coupe") || normalized.contains("arret") || normalized.contains("stop")
            val isOn = normalized.contains("allume") || normalized.contains("active") || normalized.contains("mets") || normalized.contains("start")
            val flag = if (isOff) false else if (isOn) true else null

            return ParsedCommandIntent(
                actionType = DeviceActionType.FLASHLIGHT,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                booleanFlag = flag
            )
        }

        // 4. Volume / Sound
        if (normalized.contains("volume") || normalized.contains("sonore") || normalized.contains("silencieux") || normalized.contains("coupe le son") || normalized.contains("remets le son")) {
            val percentMatch = Regex("(\\d{1,3})\\s*%").find(normalized)
            val percent = percentMatch?.groupValues?.get(1)?.toIntOrNull()

            val isIncrease = normalized.contains("augmente") || normalized.contains("monte") || normalized.contains("plus fort")
            val isDecrease = normalized.contains("baisse") || normalized.contains("diminue") || normalized.contains("moins fort")
            val isMute = normalized.contains("coupe le son") || normalized.contains("muet") || normalized.contains("silencieux") || normalized.contains("mode silencieux")
            val isUnmute = normalized.contains("remets le son") || normalized.contains("reactive le son")

            return ParsedCommandIntent(
                actionType = DeviceActionType.VOLUME,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = when {
                    isMute -> "mute"
                    isUnmute -> "unmute"
                    isIncrease -> "increase"
                    isDecrease -> "decrease"
                    percent != null -> "set"
                    else -> "info"
                },
                numericValue = percent
            )
        }

        // 5. Brightness / Display
        if (normalized.contains("luminosite") || normalized.contains("eclairage de l'ecran") || normalized.contains("lumiere de l'ecran")) {
            val percentMatch = Regex("(\\d{1,3})\\s*%").find(normalized)
            val percent = percentMatch?.groupValues?.get(1)?.toIntOrNull()

            val isIncrease = normalized.contains("augmente") || normalized.contains("monte") || normalized.contains("plus claire") || normalized.contains("plus lumineuse")
            val isDecrease = normalized.contains("baisse") || normalized.contains("diminue") || normalized.contains("plus sombre")

            return ParsedCommandIntent(
                actionType = DeviceActionType.BRIGHTNESS,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = when {
                    isIncrease -> "increase"
                    isDecrease -> "decrease"
                    percent != null -> "set"
                    else -> "info"
                },
                numericValue = percent
            )
        }

        // 6. Camera / Photo
        if ((normalized.contains("camera") || normalized.contains("appareil photo") || normalized.contains("photo") || normalized.contains("selfie")) &&
            (normalized.contains("ouvre") || normalized.contains("lance") || normalized.contains("prends") || normalized.contains("demarre"))
        ) {
            val isVideo = normalized.contains("video")
            return ParsedCommandIntent(
                actionType = DeviceActionType.CAMERA,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = if (isVideo) "video" else "photo"
            )
        }

        // 7. Navigation / System Gestures
        if (normalized == "accueil" || normalized == "retourne a l'accueil" || normalized == "ecran d'accueil" || normalized == "retour accueil" || normalized == "va a l'accueil") {
            return ParsedCommandIntent(
                actionType = DeviceActionType.NAVIGATION,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = "home"
            )
        }

        if (normalized.contains("applications recentes") || normalized.contains("applis recentes") || normalized.contains("recents") || normalized == "recentes") {
            return ParsedCommandIntent(
                actionType = DeviceActionType.NAVIGATION,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = "recents"
            )
        }

        // 8. Device Lock
        if (normalized.contains("verrouille mon telephone") || normalized.contains("verrouille l'ecran") || normalized.contains("verrouille le telephone") || normalized.contains("bloque le telephone")) {
            return ParsedCommandIntent(
                actionType = DeviceActionType.LOCK_DEVICE,
                securityLevel = ActionSecurityLevel.SAFE_ACTION
            )
        }

        // 9. Phone Call
        if (normalized.startsWith("appelle") || normalized.startsWith("appeler") || normalized.startsWith("compose") || normalized.startsWith("telephone a") || normalized.startsWith("telephoner a")) {
            val target = raw
                .replaceFirst(Regex("^(appelle|appeler|compose|composer|téléphone à|telephone a|téléphoner à|telephoner a)\\s+", RegexOption.IGNORE_CASE), "")
                .trim()

            return ParsedCommandIntent(
                actionType = DeviceActionType.PHONE_CALL,
                securityLevel = ActionSecurityLevel.SENSITIVE_ACTION,
                primaryParam = target
            )
        }

        // 10. SMS / Messaging
        if (normalized.startsWith("ecris a") || normalized.startsWith("ecris un message a") || normalized.startsWith("envoie un sms a") || normalized.startsWith("envoie un message a") || normalized.startsWith("sms a")) {
            // Pattern: "écris à Paul : je serai en retard" or "envoie un sms à Paul disant je serai en retard"
            val parts = extractSmsParts(raw)
            return ParsedCommandIntent(
                actionType = DeviceActionType.SMS,
                securityLevel = ActionSecurityLevel.SENSITIVE_ACTION,
                primaryParam = parts.first, // Recipient
                secondaryParam = parts.second // Body
            )
        }

        if (normalized == "ouvre les sms" || normalized == "ouvre les messages" || normalized == "ouvre la messagerie") {
            return ParsedCommandIntent(
                actionType = DeviceActionType.SMS,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = "open_app"
            )
        }

        // 11. Bluetooth control / settings
        if (normalized.contains("bluetooth")) {
            val isOff = normalized.contains("desactive") || normalized.contains("coupe") || normalized.contains("arret")
            val isOn = normalized.contains("active") || normalized.contains("allume") || normalized.contains("mets")
            val flag = if (isOff) false else if (isOn) true else null

            return ParsedCommandIntent(
                actionType = DeviceActionType.BLUETOOTH,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                booleanFlag = flag
            )
        }

        // 12. Wi-Fi control / settings
        if (normalized.contains("wi-fi") || normalized.contains("wifi")) {
            val isOff = normalized.contains("desactive") || normalized.contains("coupe") || normalized.contains("arret")
            val isOn = normalized.contains("active") || normalized.contains("allume") || normalized.contains("mets")
            val flag = if (isOff) false else if (isOn) true else null

            return ParsedCommandIntent(
                actionType = DeviceActionType.WIFI,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                booleanFlag = flag
            )
        }

        // 13. Settings Pages
        if (normalized.startsWith("ouvre les parametres") || normalized.startsWith("ouvre les reglages") || normalized.startsWith("ouvre parametres") || normalized == "parametres" || normalized == "reglages") {
            val target = normalized
                .replaceFirst(Regex("^(ouvre les parametres de|ouvre les parametres d'|ouvre les parametres|ouvre les reglages de|ouvre les reglages|ouvre parametres|parametres|reglages)\\s*"), "")
                .trim()

            return ParsedCommandIntent(
                actionType = DeviceActionType.SETTINGS,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = if (target.isBlank()) "general" else target
            )
        }

        // 14. Full Device Status
        if (normalized.contains("etat du telephone") || normalized.contains("statut du telephone") || normalized.contains("etat de l'appareil") || normalized.contains("rapport systeme")) {
            return ParsedCommandIntent(
                actionType = DeviceActionType.DEVICE_STATUS,
                securityLevel = ActionSecurityLevel.SAFE_ACTION
            )
        }

        // 15. Web URL or Search
        if (normalized.startsWith("ouvre http") || normalized.startsWith("ouvre www") || (normalized.contains(".com") || normalized.contains(".fr") || normalized.contains(".org") || normalized.contains(".net") || normalized.contains(".io"))) {
            val candidateUrl = raw.replaceFirst(Regex("^(ouvre|lance|visite)\\s+", RegexOption.IGNORE_CASE), "").trim()
            return ParsedCommandIntent(
                actionType = DeviceActionType.WEB_URL,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = candidateUrl
            )
        }

        if (normalized.startsWith("cherche sur le web") || normalized.startsWith("recherche sur internet") || normalized.startsWith("cherche sur google") || normalized.startsWith("recherche google")) {
            val query = raw.replaceFirst(Regex("^(cherche sur le web|recherche sur internet|cherche sur google|recherche google)\\s+", RegexOption.IGNORE_CASE), "").trim()
            return ParsedCommandIntent(
                actionType = DeviceActionType.WEB_URL,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = query,
                secondaryParam = "search"
            )
        }

        // 16. App Launch: "ouvre WhatsApp", "lance YouTube", "démarre Spotify", etc.
        if (normalized.startsWith("ouvre ") || normalized.startsWith("lance ") || normalized.startsWith("demarre ") || normalized.startsWith("start ") || normalized.startsWith("open ")) {
            val appQuery = raw
                .replaceFirst(Regex("^(ouvre|lance|démarre|demarre|start|open)\\s+", RegexOption.IGNORE_CASE), "")
                .replace(Regex("^(l'application|l'app|l'appli|application|app|appli)\\s+", RegexOption.IGNORE_CASE), "")
                .trim()

            return ParsedCommandIntent(
                actionType = DeviceActionType.OPEN_APP,
                securityLevel = ActionSecurityLevel.SAFE_ACTION,
                primaryParam = appQuery
            )
        }

        // Default: Unknown device intent, delegates to conversational reasoning AI
        return ParsedCommandIntent(
            actionType = DeviceActionType.UNKNOWN,
            securityLevel = ActionSecurityLevel.SAFE_ACTION
        )
    }

    private fun extractSmsParts(raw: String): Pair<String, String> {
        // Example: "écris à Paul : je serai en retard"
        if (raw.contains(":")) {
            val parts = raw.split(":", limit = 2)
            val recipient = parts[0]
                .replaceFirst(Regex("^(écris à|ecris a|envoie un sms à|envoie un message à|sms à)\\s*", RegexOption.IGNORE_CASE), "")
                .trim()
            val body = parts[1].trim()
            return Pair(recipient, body)
        }

        // Example: "écris à Paul disant je serai en retard"
        val disantMatch = Regex("^(?:écris à|ecris a|envoie un sms à|envoie un message à)\\s+(.+?)\\s+(?:disant|pour dire que|avec le message)\\s+(.+)$", RegexOption.IGNORE_CASE).find(raw)
        if (disantMatch != null) {
            val recipient = disantMatch.groupValues[1].trim()
            val body = disantMatch.groupValues[2].trim()
            return Pair(recipient, body)
        }

        // Fallback: recipient only
        val recipient = raw
            .replaceFirst(Regex("^(écris à|ecris a|envoie un sms à|envoie un message à|sms à)\\s*", RegexOption.IGNORE_CASE), "")
            .trim()
        return Pair(recipient, "")
    }

    private fun isConfirmationPhrase(norm: String): Boolean {
        return norm == "oui" || norm == "confirmer" || norm == "confirme" || 
               norm == "vas-y" || norm == "vas y" || norm == "d'accord" || 
               norm == "d accord" || norm == "ok" || norm == "envoie" || 
               norm == "appelle" || norm == "valider" || norm == "valide" || 
               norm == "oui confirme" || norm == "oui vas-y"
    }

    private fun isCancellationPhrase(norm: String): Boolean {
        return norm == "non" || norm == "annule" || norm == "annuler" || 
               norm == "stop" || norm == "pas maintenant" || norm == "refuse" || 
               norm == "laisse tomber" || norm == "non merci" || norm == "non annule"
    }

    private fun normalize(str: String): String {
        return Normalizer.normalize(str, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase(Locale.ROOT)
            .trim()
    }
}
