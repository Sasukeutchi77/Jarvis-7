package com.openjarvis.android.services

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.openjarvis.android.core.communication.CommunicationManager
import com.openjarvis.android.core.communication.CommunicationSource
import com.openjarvis.android.core.communication.IncomingMessage
import com.openjarvis.android.core.communication.MessageCategory
import com.openjarvis.android.core.communication.NotificationReplyAction
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.logging.JarvisLogger
import java.util.concurrent.ConcurrentHashMap

/**
 * Android NotificationListenerService for OpenJarvis
 * Observes notifications from WhatsApp, SMS, Telegram, Messenger, Signal, etc.
 * Safely extracts message sender, content and RemoteInput for inline replies.
 */
class JarvisNotificationListenerService : NotificationListenerService() {

    companion object {
        private var instance: JarvisNotificationListenerService? = null
        private val replyActionsCache = ConcurrentHashMap<String, NotificationReplyAction>()

        fun isServiceConnected(): Boolean = instance != null

        /**
         * Execute direct in-line reply via Android RemoteInput if available
         */
        fun sendDirectReply(context: Context, notificationKey: String, replyText: String): Boolean {
            val replyAction = replyActionsCache[notificationKey] ?: run {
                JarvisLogger.w("NotificationListener", "No cached reply action found for key: $notificationKey")
                return false
            }

            return try {
                val intent = Intent()
                val bundle = Bundle()
                bundle.putCharSequence(replyAction.resultKey, replyText)
                RemoteInput.addResultsToIntent(arrayOf(replyAction.remoteInput), intent, bundle)

                replyAction.pendingIntent.send(context, 0, intent)
                JarvisLogger.i("NotificationListener", "Direct reply successfully sent to $notificationKey")
                true
            } catch (e: Exception) {
                JarvisLogger.e("NotificationListener", "Failed to send direct reply", e)
                false
            }
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        JarvisLogger.i("NotificationListener", "JarvisNotificationListenerService connected and active.")
        JarvisEventBus.emit(JarvisEvent.SystemAlert("Service d'écoute des notifications JARVIS activé.", "INFO"))
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        instance = null
        JarvisLogger.w("NotificationListener", "JarvisNotificationListenerService disconnected.")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkg = sbn.packageName ?: return
        if (pkg == packageName) return // Ignore own notifications

        // Check if listener is enabled in settings
        if (!CommunicationManager.isListenerEnabled()) return

        val notification = sbn.notification ?: return

        // Skip non-messaging/non-conversation ongoing notifications (e.g. background syncs)
        if ((notification.flags and Notification.FLAG_ONGOING_EVENT) != 0 &&
            notification.category != Notification.CATEGORY_MESSAGE &&
            notification.category != Notification.CATEGORY_SOCIAL
        ) {
            return
        }

        try {
            val source = CommunicationSource.fromPackageName(pkg)
            val extras = notification.extras ?: Bundle()

            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim() ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()
                ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
                ?: ""

            // Skip empty notifications
            if (title.isBlank() && text.isBlank()) return

            val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()?.trim()
            val conversationTitle = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()?.trim()

            val sender = if (conversationTitle != null && conversationTitle.isNotBlank() && title.isNotBlank() && title != conversationTitle) {
                title
            } else if (title.isNotBlank()) {
                title
            } else {
                source.name
            }

            val isGroup = conversationTitle != null && conversationTitle.isNotBlank()

            // Find RemoteInput reply action if available
            val replyAction = findReplyAction(notification)
            val replyAvailable = replyAction != null
            val notificationKey = sbn.key ?: "notif_${sbn.id}_${pkg}"

            if (replyAction != null) {
                replyActionsCache[notificationKey] = replyAction
            }

            // Quick heuristic category determination (will be enhanced by AI Agent)
            val lowerText = text.lowercase()
            val category = when {
                lowerText.contains("urgent") || lowerText.contains("urgence") || lowerText.contains("immédiat") || lowerText.contains("appelle-moi") -> MessageCategory.URGENT
                lowerText.contains("?") || lowerText.contains("peux-tu") || lowerText.contains("dis-moi") || lowerText.contains("quand") || lowerText.contains("tu viens") -> MessageCategory.TO_REPLY
                lowerText.contains("important") || lowerText.contains("attention") || lowerText.contains("rappel") -> MessageCategory.IMPORTANT
                else -> MessageCategory.INFO
            }

            val incomingMessage = IncomingMessage(
                id = "msg_${sbn.id}_${System.currentTimeMillis()}",
                source = source.type,
                packageName = pkg,
                appName = source.name,
                sender = sender,
                title = title,
                content = text,
                timestamp = sbn.postTime.takeIf { it > 0 } ?: System.currentTimeMillis(),
                conversationId = conversationTitle ?: sender,
                notificationKey = notificationKey,
                notificationId = sbn.id,
                replyAvailable = replyAvailable,
                category = category,
                isGroup = isGroup,
                groupTitle = conversationTitle,
                isRead = false,
                isSpoken = false,
                isProtected = CommunicationManager.isProtectedContactOrApp(sender, pkg),
                metadata = mapOf(
                    "subText" to (subText ?: ""),
                    "category" to (notification.category ?: "")
                )
            )

            CommunicationManager.handleIncomingMessage(this, incomingMessage)

        } catch (e: Exception) {
            JarvisLogger.e("NotificationListener", "Error processing notification from $pkg", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        sbn?.key?.let { key ->
            replyActionsCache.remove(key)
        }
    }

    /**
     * Search notification actions for a valid RemoteInput capable action
     */
    private fun findReplyAction(notification: Notification): NotificationReplyAction? {
        val actions = notification.actions ?: return null

        for (action in actions) {
            val remoteInputs = action.remoteInputs ?: continue
            for (ri in remoteInputs) {
                if (ri.allowFreeFormInput && action.actionIntent != null) {
                    val compatRemoteInput = RemoteInput.Builder(ri.resultKey)
                        .setLabel(ri.label)
                        .setChoices(ri.choices)
                        .setAllowFreeFormInput(ri.allowFreeFormInput)
                        .addExtras(ri.extras)
                        .build()

                    return NotificationReplyAction(
                        title = action.title?.toString() ?: "Répondre",
                        pendingIntent = action.actionIntent,
                        remoteInput = compatRemoteInput,
                        resultKey = ri.resultKey
                    )
                }
            }
        }
        return null
    }
}
