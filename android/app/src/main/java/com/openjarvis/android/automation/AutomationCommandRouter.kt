package com.openjarvis.android.automation

import com.openjarvis.android.automation.model.*
import com.openjarvis.android.logging.JarvisLogger
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

/**
 * Natural language intent parser for voice and chat automation commands.
 * Handles reminders, alarms, briefings, routine management, and testing.
 */
class AutomationCommandRouter(
    private val automationManager: AutomationManager
) {

    data class CommandParseResult(
        val handled: Boolean,
        val responseText: String? = null,
        val createdAutomation: Automation? = null
    )

    /**
     * Tries to interpret and execute an automation command from spoken or typed user text.
     */
    suspend fun handleCommand(rawInput: String): CommandParseResult {
        val input = rawInput.trim().lowercase(Locale.FRENCH)

        // 1. List / Query Automations
        if (input.contains("liste mes automatisations") ||
            input.contains("quelles sont mes automatisations") ||
            input.contains("affiche mes routines") ||
            input.contains("mes rappels") ||
            input.contains("mes alarmes")
        ) {
            val list = automationManager.repository.getAllAutomations()
            if (list.isEmpty()) {
                return CommandParseResult(
                    handled = true,
                    responseText = "Monsieur, vous n'avez aucune automatisation configurée pour le moment."
                )
            }
            val summary = list.joinToString("\n") { auto ->
                val status = if (auto.enabled) "Actif" else "Désactivé"
                "• ${auto.name} ($status) : ${auto.description}"
            }
            return CommandParseResult(
                handled = true,
                responseText = "Voici vos automatisations actuelles :\n$summary"
            )
        }

        // 2. Test Automation
        val testMatcher = Pattern.compile("(?:teste|tester|exécute|lance)(?: l'automatisation| la routine| le rappel)? (.+)").matcher(input)
        if (testMatcher.find()) {
            val targetName = testMatcher.group(1)?.trim() ?: ""
            if (targetName.isNotBlank() && !targetName.startsWith("la musique") && !targetName.startsWith("l'application")) {
                val auto = findMatchingAutomation(targetName)
                if (auto != null) {
                    val result = automationManager.testAutomation(auto.id)
                    val statusText = if (result?.status == ExecutionStatus.SUCCESS) "réussie" else "échouée"
                    return CommandParseResult(
                        handled = true,
                        responseText = "Simulation de l'automatisation « ${auto.name} » $statusText."
                    )
                }
            }
        }

        // 3. Enable / Disable Automation
        val toggleMatcher = Pattern.compile("(active|activez|désactive|désactivez)(?: l'automatisation| la routine| le rappel)? (.+)").matcher(input)
        if (toggleMatcher.find()) {
            val action = toggleMatcher.group(1)?.lowercase(Locale.FRENCH) ?: ""
            val nameQuery = toggleMatcher.group(2)?.trim() ?: ""
            val enable = action.startsWith("active")
            val auto = findMatchingAutomation(nameQuery)
            if (auto != null) {
                automationManager.toggleAutomation(auto.id, enable)
                val stateText = if (enable) "activée" else "désactivée"
                return CommandParseResult(
                    handled = true,
                    responseText = "L'automatisation « ${auto.name} » est désormais $stateText."
                )
            }
        }

        // 4. Delete Automation
        val deleteMatcher = Pattern.compile("(?:supprime|efface|annule)(?: l'automatisation| la routine| le rappel)? (.+)").matcher(input)
        if (deleteMatcher.find()) {
            val nameQuery = deleteMatcher.group(1)?.trim() ?: ""
            val auto = findMatchingAutomation(nameQuery)
            if (auto != null) {
                automationManager.deleteAutomation(auto.id)
                return CommandParseResult(
                    handled = true,
                    responseText = "L'automatisation « ${auto.name} » a été supprimée."
                )
            }
        }

        // 5. Create Reminder: "Rappelle-moi à 18h de [faire qqch]" or "Rappelle-moi dans X minutes de [faire qqch]"
        val reminderRelativeMatcher = Pattern.compile("rappelle[- ]moi dans (\\d+)\\s*(?:min|minutes?)(?: de | d'| : )?(.+)").matcher(input)
        if (reminderRelativeMatcher.find()) {
            val minutes = reminderRelativeMatcher.group(1)?.toLongOrNull() ?: 10L
            val reminderContent = reminderRelativeMatcher.group(2)?.trim() ?: "Rappel"
            val targetTimestamp = System.currentTimeMillis() + (minutes * 60_000L)

            val auto = Automation(
                name = "Rappel : ${reminderContent.capitalize(Locale.FRENCH)}",
                description = "Dans $minutes minutes : $reminderContent",
                enabled = true,
                trigger = AutomationTrigger(
                    type = TriggerType.DATE_TRIGGER,
                    targetTimestamp = targetTimestamp,
                    repeatPattern = RepeatPattern.ONCE
                ),
                actions = listOf(
                    AutomationAction(
                        type = ActionType.SPEAK,
                        message = "Monsieur, voici votre rappel : $reminderContent"
                    ),
                    AutomationAction(
                        type = ActionType.SHOW_NOTIFICATION,
                        notificationTitle = "JARVIS - Rappel",
                        notificationBody = reminderContent
                    )
                ),
                priority = 5
            )
            automationManager.createOrUpdateAutomation(auto)
            return CommandParseResult(
                handled = true,
                responseText = "Bien reçu. Je vous rappellerai de « $reminderContent » dans $minutes minutes.",
                createdAutomation = auto
            )
        }

        // 6. Reminder at fixed hour: "Rappelle-moi à 14h30 de..." or "Rappelle-moi à 14:30 d'..."
        val reminderHourMatcher = Pattern.compile("rappelle[- ]moi à (\\d{1,2})[h:](\\d{2})?(?: de | d'| : )?(.+)").matcher(input)
        if (reminderHourMatcher.find()) {
            val hour = reminderHourMatcher.group(1)?.toIntOrNull() ?: 12
            val minute = reminderHourMatcher.group(2)?.toIntOrNull() ?: 0
            val reminderContent = reminderHourMatcher.group(3)?.trim() ?: "Rappel"
            val timeFormatted = String.format(Locale.ROOT, "%02d:%02d", hour, minute)

            val auto = Automation(
                name = "Rappel : ${reminderContent.capitalize(Locale.FRENCH)}",
                description = "À $timeFormatted : $reminderContent",
                enabled = true,
                trigger = AutomationTrigger(
                    type = TriggerType.TIME_TRIGGER,
                    timeOfDay = timeFormatted,
                    repeatPattern = RepeatPattern.ONCE
                ),
                actions = listOf(
                    AutomationAction(
                        type = ActionType.SPEAK,
                        message = "Monsieur, il est $timeFormatted. Rappel : $reminderContent"
                    ),
                    AutomationAction(
                        type = ActionType.SHOW_NOTIFICATION,
                        notificationTitle = "JARVIS - Rappel $timeFormatted",
                        notificationBody = reminderContent
                    )
                ),
                priority = 5
            )
            automationManager.createOrUpdateAutomation(auto)
            return CommandParseResult(
                handled = true,
                responseText = "Rappel programmé pour $timeFormatted : « $reminderContent ».",
                createdAutomation = auto
            )
        }

        // 7. Daily Routine creation: "Tous les matins à 7h fais le briefing"
        if (input.contains("tous les matins") || input.contains("chaque matin") || input.contains("tous les jours à")) {
            val hourMatch = Pattern.compile("(\\d{1,2})[h:](\\d{2})?").matcher(input)
            val timeFormatted = if (hourMatch.find()) {
                val h = hourMatch.group(1)?.toIntOrNull() ?: 7
                val m = hourMatch.group(2)?.toIntOrNull() ?: 0
                String.format(Locale.ROOT, "%02d:%02d", h, m)
            } else "07:00"

            val auto = Automation(
                name = "Routine Quotidienne ($timeFormatted)",
                description = "Exécution quotidienne à $timeFormatted",
                enabled = true,
                trigger = AutomationTrigger(
                    type = TriggerType.TIME_TRIGGER,
                    timeOfDay = timeFormatted,
                    repeatPattern = RepeatPattern.DAILY
                ),
                actions = listOf(
                    AutomationAction(type = ActionType.START_BRIEFING)
                ),
                priority = 8
            )
            automationManager.createOrUpdateAutomation(auto)
            return CommandParseResult(
                handled = true,
                responseText = "Routine quotidienne configurée pour chaque matin à $timeFormatted.",
                createdAutomation = auto
            )
        }

        return CommandParseResult(handled = false)
    }

    private suspend fun findMatchingAutomation(query: String): Automation? {
        val cleanQuery = query.lowercase(Locale.FRENCH).trim()
        val all = automationManager.repository.getAllAutomations()
        return all.find { it.name.lowercase(Locale.FRENCH).contains(cleanQuery) }
            ?: all.find { cleanQuery.contains(it.name.lowercase(Locale.FRENCH)) }
    }
}
