package com.openjarvis.android.communication.notifications

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.openjarvis.android.communication.context.CommunicationContext
import com.openjarvis.android.communication.messaging.MessagingAppController
import com.openjarvis.android.communication.model.ActiveNotification
import com.openjarvis.android.communication.model.CommunicationActionResult
import com.openjarvis.android.communication.model.CommunicationActionType
import com.openjarvis.android.communication.model.CommunicationResultStatus
import com.openjarvis.android.communication.model.NotificationCategory
import com.openjarvis.android.communication.model.NotificationReplyAction
import com.openjarvis.android.communication.model.PendingNotificationReply
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentHashMap

/**
 * High-precision Notification Controller for JARVIS.
 * Observes notifications from JarvisNotificationListenerService, performs deduplication,
 * handles smart categorization, provides voice readout, and executes in-line RemoteInput replies.
 */
class NotificationController(
    private val context: Context,
    private val messagingAppController: MessagingAppController,
    private val communicationContext: CommunicationContext
) {

    private val _activeNotifications = MutableStateFlow<List<ActiveNotification>>(emptyList())
    val activeNotifications: StateFlow<List<ActiveNotification>> = _activeNotifications.asStateFlow()

    // Keyed cache for fast lookup & deduplication: notificationKey -> ActiveNotification
    private val notificationMap = ConcurrentHashMap<String, ActiveNotification>()

    // Set of spoken notification content hashes to avoid re-announcing identical messages
    private val spokenHashes = ConcurrentHashMap.newKeySet<Int>()

    fun isNotificationAccessGranted(): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(context.packageName)
    }

    /**
     * Process an incoming notification from JarvisNotificationListenerService.
     */
    fun onNotificationPosted(
        key: String,
        id: Int,
        packageName: String,
        title: String?,
        text: String?,
        subText: String?,
        postTime: Long,
        isGroupSummary: Boolean,
        groupKey: String?,
        actions: List<NotificationCompat.Action>?
    ) {
        // Filter out empty system noise
        val cleanTitle = title?.trim() ?: ""
        val cleanText = text?.trim() ?: ""
        if (cleanTitle.isBlank() && cleanText.isBlank()) return

        // Skip OpenJarvis own foreground/HUD service notifications
        if (packageName == context.packageName) return

        // Extract direct reply RemoteInput action if present
        val replyAction = extractReplyAction(actions)

        val sourceType = messagingAppController.getSourceTypeForPackage(packageName)
        val appName = messagingAppController.getAppNameForPackage(packageName)
        val category = determineCategory(packageName, cleanTitle, cleanText)

        val activeNotif = ActiveNotification(
            id = "${packageName}_${id}_${postTime}",
            notificationKey = key,
            notificationId = id,
            packageName = packageName,
            appName = appName,
            sourceType = sourceType,
            sender = if (cleanTitle.isNotBlank()) cleanTitle else appName,
            title = cleanTitle,
            content = cleanText,
            timestamp = postTime,
            category = category,
            isGroup = isGroupSummary,
            groupTitle = subText ?: groupKey,
            replyAction = replyAction,
            subText = subText
        )

        // Deduplication & update
        notificationMap[key] = activeNotif
        refreshActiveList()

        JarvisLogger.d("NotificationController", "Active notification recorded from $appName: $cleanTitle (CanReply: ${replyAction != null})")
    }

    /**
     * Remove dismissed notification from cache.
     */
    fun onNotificationRemoved(key: String) {
        val removed = notificationMap.remove(key)
        if (removed != null) {
            refreshActiveList()
            JarvisLogger.d("NotificationController", "Notification removed: ${removed.sender} (${removed.appName})")
        }
    }

    /**
     * Read all active notifications or filtered by category.
     */
    fun readActiveNotifications(categoryFilter: NotificationCategory? = null): CommunicationActionResult {
        if (!isNotificationAccessGranted()) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.PERMISSION_REQUIRED,
                spokenMessage = "L'accès aux notifications n'est pas encore accordé. Souhaitez-vous ouvrir les paramètres pour l'autoriser ?",
                actionType = CommunicationActionType.READ_NOTIFICATIONS,
                details = mapOf("action" to "OPEN_NOTIFICATION_SETTINGS")
            )
        }

        var list = notificationMap.values.sortedByDescending { it.timestamp }
        if (categoryFilter != null) {
            list = list.filter { it.category == categoryFilter }
        }

        // Deduplicate summary duplicates (keep child notifications if available)
        val nonSummary = list.filter { !it.isGroup }
        val effectiveList = if (nonSummary.isNotEmpty()) nonSummary else list

        if (effectiveList.isEmpty()) {
            val msg = if (categoryFilter != null) {
                "Vous n'avez aucune notification active dans la catégorie ${categoryFilter.label}."
            } else {
                "Vous n'avez aucune notification non lue pour le moment."
            }
            return CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = msg,
                actionType = CommunicationActionType.READ_NOTIFICATIONS
            )
        }

        // Save into context for next/reply navigation
        communicationContext.setNotificationList(effectiveList)

        // Build human-like natural spoken message
        val totalCount = effectiveList.size
        val spokenText = if (totalCount == 1) {
            val notif = effectiveList.first()
            "Vous avez 1 notification de ${notif.appName} de la part de ${notif.sender} : « ${notif.content} »"
        } else {
            val appCounts = effectiveList.groupBy { it.appName }.map { "${it.value.size} sur ${it.key}" }.joinToString(", ")
            val first = effectiveList.first()
            "Vous avez $totalCount notifications : $appCounts. La plus récente est de ${first.sender} (${first.appName}) : « ${first.content} »"
        }

        return CommunicationActionResult(
            status = CommunicationResultStatus.SUCCESS,
            spokenMessage = spokenText,
            actionType = CommunicationActionType.READ_NOTIFICATIONS,
            details = mapOf(
                "totalCount" to totalCount,
                "notifications" to effectiveList.map { mapOf("sender" to it.sender, "appName" to it.appName, "content" to it.content) }
            )
        )
    }

    /**
     * Read notifications specifically for a requested messaging app (e.g. WhatsApp, Telegram).
     */
    fun readAppNotifications(appQuery: String): CommunicationActionResult {
        if (!isNotificationAccessGranted()) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.PERMISSION_REQUIRED,
                spokenMessage = "L'accès aux notifications n'est pas autorisé. Voulez-vous ouvrir les réglages ?",
                actionType = CommunicationActionType.READ_APP_NOTIFICATIONS
            )
        }

        val normQuery = appQuery.lowercase().trim()
        val matchingNotifs = notificationMap.values
            .filter { it.appName.lowercase().contains(normQuery) || it.packageName.lowercase().contains(normQuery) }
            .sortedByDescending { it.timestamp }

        if (matchingNotifs.isEmpty()) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = "Vous n'avez aucune notification active pour $appQuery.",
                actionType = CommunicationActionType.READ_APP_NOTIFICATIONS
            )
        }

        communicationContext.setNotificationList(matchingNotifs)

        val count = matchingNotifs.size
        val first = matchingNotifs.first()
        val spoken = if (count == 1) {
            "Vous avez 1 notification ${first.appName} de ${first.sender} : « ${first.content} »"
        } else {
            val senders = matchingNotifs.map { it.sender }.distinct().joinToString(", ")
            "Vous avez $count notifications ${first.appName} de $senders. La dernière est : « ${first.content} »"
        }

        return CommunicationActionResult(
            status = CommunicationResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = CommunicationActionType.READ_APP_NOTIFICATIONS,
            details = mapOf("count" to count, "appName" to first.appName, "notifications" to matchingNotifs)
        )
    }

    /**
     * Read the next notification in the active queue.
     */
    fun readNextNotification(): CommunicationActionResult {
        val next = communicationContext.getNextNotification()
        if (next == null) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = "C'était la dernière notification de la liste.",
                actionType = CommunicationActionType.NEXT_NOTIFICATION
            )
        }

        val spoken = "Notification suivante de ${next.sender} (${next.appName}) : « ${next.content} »"
        return CommunicationActionResult(
            status = CommunicationResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = CommunicationActionType.NEXT_NOTIFICATION,
            details = mapOf("sender" to next.sender, "appName" to next.appName, "content" to next.content)
        )
    }

    /**
     * Prepare an in-line reply to a notification.
     */
    fun prepareNotificationReply(
        targetSender: String?,
        replyContent: String
    ): CommunicationActionResult {
        val effectiveKey = communicationContext.getEffectiveNotificationKey()
        var targetNotif: ActiveNotification? = null

        if (effectiveKey != null) {
            targetNotif = notificationMap[effectiveKey]
        }

        if (targetNotif == null && !targetSender.isNullOrBlank()) {
            val norm = targetSender.lowercase().trim()
            targetNotif = notificationMap.values.firstOrNull { it.sender.lowercase().contains(norm) }
        }

        if (targetNotif == null) {
            targetNotif = notificationMap.values.maxByOrNull { it.timestamp }
        }

        if (targetNotif == null) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = "Je ne trouve aucun message récent auquel répondre.",
                actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
                error = "No active notification to reply to"
            )
        }

        val replyAction = targetNotif.replyAction
        if (replyAction == null) {
            // Cannot reply inline, fallback to opening the app
            val opened = messagingAppController.openApp(targetNotif.packageName)
            val spoken = if (opened) {
                "${targetNotif.appName} ne supporte pas la réponse directe. J'ai ouvert l'application pour vous."
            } else {
                "Cette notification ne permet pas de réponse vocale directe."
            }
            return CommunicationActionResult(
                status = CommunicationResultStatus.NOT_SUPPORTED,
                spokenMessage = spoken,
                actionType = CommunicationActionType.REPLY_TO_NOTIFICATION
            )
        }

        val pendingReply = PendingNotificationReply(
            id = "reply_${System.currentTimeMillis()}",
            notificationKey = targetNotif.notificationKey,
            targetSender = targetNotif.sender,
            appName = targetNotif.appName,
            replyText = replyContent,
            replyAction = replyAction
        )
        communicationContext.setPendingNotificationReply(pendingReply)

        val spoken = "Je vais répondre à ${targetNotif.sender} sur ${targetNotif.appName} : « $replyContent ». Confirmer ?"
        return CommunicationActionResult(
            status = CommunicationResultStatus.REQUIRES_CONFIRMATION,
            spokenMessage = spoken,
            actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
            details = mapOf(
                "targetSender" to targetNotif.sender,
                "appName" to targetNotif.appName,
                "replyText" to replyContent,
                "notificationKey" to targetNotif.notificationKey
            )
        )
    }

    /**
     * Send confirmed inline reply using Android RemoteInput.
     */
    fun executeConfirmedReply(pending: PendingNotificationReply): CommunicationActionResult {
        return try {
            val replyAction = pending.replyAction
            val intent = Intent()
            val bundle = Bundle()
            bundle.putCharSequence(replyAction.resultKey, pending.replyText)

            val remoteInputs = arrayOf(replyAction.remoteInput)
            RemoteInput.addResultsToIntent(remoteInputs, intent, bundle)

            replyAction.pendingIntent.send(context, 0, intent)
            communicationContext.clearPendingNotificationReply()
            JarvisLogger.i("NotificationController", "Sent inline reply to ${pending.targetSender} on ${pending.appName}")

            CommunicationActionResult(
                status = CommunicationResultStatus.SUCCESS,
                spokenMessage = "Votre réponse a été envoyée à ${pending.targetSender}.",
                actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
                details = mapOf("sender" to pending.targetSender, "appName" to pending.appName, "text" to pending.replyText)
            )
        } catch (e: Exception) {
            JarvisLogger.e("NotificationController", "Failed to send RemoteInput reply", e)
            CommunicationActionResult(
                status = CommunicationResultStatus.REPLY_FAILED,
                spokenMessage = "Échec de l'envoi de la réponse : ${e.message}",
                actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
                error = e.message
            )
        }
    }

    /**
     * Produce a concise local AI/heuristic summary of all active notifications without leaking private content.
     */
    fun summarizeNotifications(): CommunicationActionResult {
        if (!isNotificationAccessGranted()) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.PERMISSION_REQUIRED,
                spokenMessage = "L'accès aux notifications est requis pour établir un résumé.",
                actionType = CommunicationActionType.SUMMARIZE_NOTIFICATIONS
            )
        }

        val all = notificationMap.values.toList()
        if (all.isEmpty()) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = "Aucune notification à résumer.",
                actionType = CommunicationActionType.SUMMARIZE_NOTIFICATIONS
            )
        }

        val byCategory = all.groupBy { it.category }
        val summaryParts = mutableListOf<String>()

        byCategory[NotificationCategory.MESSAGES]?.let {
            val senders = it.map { n -> n.sender }.distinct().joinToString(", ")
            summaryParts.add("${it.size} message(s) de $senders")
        }
        byCategory[NotificationCategory.APPELS]?.let {
            summaryParts.add("${it.size} appel(s) ou notification(s) vocale(s)")
        }
        byCategory[NotificationCategory.CALENDRIER]?.let {
            summaryParts.add("${it.size} rappel(s) de calendrier")
        }
        byCategory[NotificationCategory.APPLICATIONS]?.let {
            summaryParts.add("${it.size} alerte(s) d'applications")
        }

        val spoken = "Résumé de vos ${all.size} notifications : " + summaryParts.joinToString(" ; ") + "."
        return CommunicationActionResult(
            status = CommunicationResultStatus.SUCCESS,
            spokenMessage = spoken,
            actionType = CommunicationActionType.SUMMARIZE_NOTIFICATIONS,
            details = mapOf("totalCount" to all.size, "categories" to byCategory.mapValues { it.value.size })
        )
    }

    private fun extractReplyAction(actions: List<NotificationCompat.Action>?): NotificationReplyAction? {
        if (actions == null) return null
        for (action in actions) {
            val remoteInputs = action.remoteInputs
            if (remoteInputs != null && remoteInputs.isNotEmpty()) {
                val input = remoteInputs[0]
                val pendingIntent = action.actionIntent
                if (pendingIntent != null && input.resultKey != null) {
                    return NotificationReplyAction(
                        title = action.title?.toString() ?: "Répondre",
                        pendingIntent = pendingIntent,
                        remoteInput = input,
                        resultKey = input.resultKey
                    )
                }
            }
        }
        return null
    }

    private fun determineCategory(packageName: String, title: String, content: String): NotificationCategory {
        val lowerPkg = packageName.lowercase()
        val lowerText = (title + " " + content).lowercase()

        return when {
            lowerPkg.contains("whatsapp") || lowerPkg.contains("telegram") || lowerPkg.contains("signal") ||
            lowerPkg.contains("messaging") || lowerPkg.contains("mms") || lowerPkg.contains("sms") ||
            lowerPkg.contains("orca") || lowerPkg.contains("discord") || lowerPkg.contains("slack") -> NotificationCategory.MESSAGES

            lowerPkg.contains("dialer") || lowerPkg.contains("phone") || lowerPkg.contains("telecom") ||
            lowerText.contains("appel") || lowerText.contains("call") || lowerText.contains("manqué") -> NotificationCategory.APPELS

            lowerPkg.contains("calendar") || lowerPkg.contains("agenda") || lowerText.contains("rendez-vous") ||
            lowerText.contains("reunion") || lowerText.contains("meeting") -> NotificationCategory.CALENDRIER

            lowerText.contains("sécurité") || lowerText.contains("security") || lowerText.contains("alerte") ||
            lowerText.contains("code de validation") || lowerText.contains("otp") -> NotificationCategory.SECURITE

            else -> NotificationCategory.APPLICATIONS
        }
    }

    private fun refreshActiveList() {
        _activeNotifications.value = notificationMap.values.sortedByDescending { it.timestamp }
    }
}
