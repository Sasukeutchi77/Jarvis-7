package com.openjarvis.android.automation.model

import java.util.UUID

/**
 * Trigger Types supported by the JARVIS Automation Engine on Android OS.
 */
enum class TriggerType(val frenchLabel: String) {
    TIME_TRIGGER("Heure fixe (Quotidien/Répétition)"),
    DATE_TRIGGER("Date & Heure exacte"),
    INTERVAL_TRIGGER("Intervalle récurrent"),
    NOTIFICATION_TRIGGER("Réception de Notification"),
    BATTERY_TRIGGER("Niveau de Batterie"),
    CHARGING_TRIGGER("État de Charge"),
    APP_TRIGGER("Lancement d'Application"),
    DEVICE_STATE_TRIGGER("État du Système"),
    VOICE_TRIGGER("Déclenchement Vocal"),
    MANUAL_TRIGGER("Déclenchement Manuel");

    companion object {
        fun fromString(value: String): TriggerType {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: MANUAL_TRIGGER
        }
    }
}

/**
 * Boolean and Relational Comparison Operators for Automation Conditions.
 */
enum class ConditionOperator {
    EQUALS,
    NOT_EQUALS,
    GREATER_THAN,
    LESS_THAN,
    CONTAINS,
    BETWEEN,
    AND,
    OR,
    NOT;

    companion object {
        fun fromString(value: String): ConditionOperator {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: EQUALS
        }
    }
}

/**
 * Action Types executable by the JARVIS Automation Engine.
 */
enum class ActionType(val frenchLabel: String, val isSensitive: Boolean) {
    SHOW_NOTIFICATION("Afficher une notification", false),
    SPEAK("Synthèse vocale (TTS)", false),
    OPEN_APP("Ouvrir une application", false),
    OPEN_SETTINGS("Ouvrir les paramètres", false),
    SET_VOLUME("Régler le volume", false),
    SET_BRIGHTNESS("Régler la luminosité", false),
    FLASHLIGHT("Contrôler la torche", false),
    SEND_SMS("Envoyer un SMS", true),
    REPLY_NOTIFICATION("Répondre à une notification", true),
    RUN_JARVIS_COMMAND("Exécuter une commande JARVIS", false),
    GET_BATTERY_STATUS("Vérifier la batterie", false),
    GET_WEATHER("Consulter la météo", false),
    SHOW_HOLOGRAM("Activer l'hologramme", false),
    START_BRIEFING("Donner le briefing complet", false);

    companion object {
        fun fromString(value: String): ActionType {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: SPEAK
        }
    }
}

/**
 * Execution Status for Automation History & Diagnostics.
 */
enum class ExecutionStatus(val frenchLabel: String) {
    SUCCESS("Succès"),
    FAILED("Échec"),
    PERMISSION_REQUIRED("Permission requise"),
    NOT_SUPPORTED("Non supporté"),
    CANCELLED("Annulé"),
    SKIPPED("Ignoré (Condition non satisfaite / Cooldown)"),
    PENDING_CONFIRMATION("En attente de confirmation");

    companion object {
        fun fromString(value: String): ExecutionStatus {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: FAILED
        }
    }
}

/**
 * Repetition Patterns for time/date based automations.
 */
enum class RepeatPattern(val frenchLabel: String) {
    ONCE("Une seule fois"),
    DAILY("Tous les jours"),
    WEEKLY("Chaque semaine"),
    WEEKDAYS("Jours ouvrés (Lun-Ven)"),
    MONTHLY("Chaque mois"),
    INTERVAL("Intervalle");

    companion object {
        fun fromString(value: String): RepeatPattern {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: ONCE
        }
    }
}

/**
 * Trigger definition payload.
 */
data class AutomationTrigger(
    val type: TriggerType = TriggerType.MANUAL_TRIGGER,
    val timeOfDay: String? = null,              // e.g. "07:00", "22:00" (HH:mm)
    val targetTimestamp: Long? = null,          // Epoch millis for exact one-shot alarms
    val intervalMinutes: Long? = null,          // Periodic WorkManager interval
    val daysOfWeek: List<Int> = emptyList(),     // java.util.Calendar.MONDAY, etc.
    val repeatPattern: RepeatPattern = RepeatPattern.ONCE,
    val batteryThreshold: Int? = null,          // e.g. 20 (percent)
    val batteryTriggerBelow: Boolean = true,     // true if trigger when <= threshold
    val isCharging: Boolean? = null,            // true = when starts charging, false = disconnected
    val notificationPackage: String? = null,    // e.g. "com.whatsapp"
    val notificationSender: String? = null,     // e.g. "Paul"
    val notificationKeyword: String? = null,    // e.g. "urgent"
    val appPackageName: String? = null,         // e.g. "com.google.android.youtube"
    val deviceStateKey: String? = null,         // e.g. "screen_on", "wifi_connected"
    val voicePhrase: String? = null             // Custom trigger phrase
)

/**
 * Condition evaluation rule with support for composite AND/OR/NOT trees.
 */
data class AutomationCondition(
    val id: String = UUID.randomUUID().toString(),
    val field: String = "",                     // "battery_level", "is_charging", "time_between", "app_running", "notification_content", "device_locked"
    val operator: ConditionOperator = ConditionOperator.EQUALS,
    val value: String = "",
    val subConditions: List<AutomationCondition> = emptyList()
)

/**
 * Single actionable step within an automation pipeline.
 */
data class AutomationAction(
    val id: String = UUID.randomUUID().toString(),
    val type: ActionType = ActionType.SPEAK,
    val isSensitive: Boolean = false,
    val message: String? = null,
    val targetApp: String? = null,
    val phoneNumber: String? = null,
    val contactName: String? = null,
    val command: String? = null,
    val notificationTitle: String? = null,
    val notificationBody: String? = null,
    val intParam: Int? = null,
    val boolParam: Boolean? = null,
    val parameters: Map<String, String> = emptyMap()
)

/**
 * Main Domain Model for a JARVIS Automation.
 */
data class Automation(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val description: String = "",
    val enabled: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val trigger: AutomationTrigger = AutomationTrigger(),
    val conditions: List<AutomationCondition> = emptyList(),
    val actions: List<AutomationAction> = emptyList(),
    val priority: Int = 1,
    val runCount: Int = 0,
    val lastRun: Long? = null,
    val nextRun: Long? = null,
    val requiresConfirmation: Boolean = false,
    val cooldownSeconds: Long = 60L,
    val lastTriggeredAt: Long? = null,
    val isSystem: Boolean = false
)

/**
 * Result log of an execution pass.
 */
data class ExecutionResult(
    val automationId: String,
    val automationName: String,
    val timestamp: Long = System.currentTimeMillis(),
    val trigger: TriggerType,
    val status: ExecutionStatus,
    val durationMs: Long = 0L,
    val errorCode: String? = null,
    val executedActions: List<String> = emptyList(),
    val spokenMessage: String? = null,
    val isSimulated: Boolean = false
)

/**
 * Pending user confirmation for sensitive actions (SMS, call, data manipulation).
 */
data class AutomationPendingConfirmation(
    val automationId: String,
    val automationName: String,
    val action: AutomationAction,
    val prompt: String,
    val timestamp: Long = System.currentTimeMillis(),
    val onConfirm: suspend () -> ExecutionResult
)
