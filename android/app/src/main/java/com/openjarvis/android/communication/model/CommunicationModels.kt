package com.openjarvis.android.communication.model

import android.app.PendingIntent
import androidx.core.app.RemoteInput

/**
 * Types of communication sources recognized by JARVIS.
 */
enum class CommunicationSourceType(val displayName: String, val iconName: String) {
    WHATSAPP("WhatsApp", "MessageCircle"),
    SMS("SMS & Messagerie", "MessageSquare"),
    TELEGRAM("Telegram", "Send"),
    MESSENGER("Messenger", "MessageCircle"),
    SIGNAL("Signal", "Shield"),
    GMAIL("Gmail", "Mail"),
    GENERIC("Application", "Bell"),
    OTHER("Autre", "Bell")
}

/**
 * System categories for incoming notifications.
 */
enum class NotificationCategory(val id: String, val label: String, val emoji: String) {
    MESSAGES("MESSAGES", "Messages & Discussions", "💬"),
    APPELS("APPELS", "Appels & Messagerie vocale", "📞"),
    SECURITE("SECURITE", "Sécurité & Alertes", "🛡️"),
    CALENDRIER("CALENDRIER", "Calendrier & Rendez-vous", "📅"),
    APPLICATIONS("APPLICATIONS", "Applications & Outils", "📱"),
    AUTRES("AUTRES", "Autres notifications", "⚪");

    companion object {
        fun fromId(id: String): NotificationCategory {
            return values().firstOrNull { it.id.equals(id, ignoreCase = true) } ?: AUTRES
        }
    }
}

/**
 * Detailed capability matrix of a messaging application on Android.
 */
data class MessagingCapability(
    val packageName: String,
    val appName: String,
    val canRead: Boolean = true,
    val canReply: Boolean = false,
    val canOpen: Boolean = true,
    val canMarkRead: Boolean = false,
    val supportsRemoteInput: Boolean = false,
    val isInstalled: Boolean = false
)

/**
 * Represents an SMS stored in the device inbox/outbox.
 */
data class SmsRecord(
    val id: String,
    val threadId: String,
    val address: String,
    val contactName: String?,
    val body: String,
    val timestamp: Long,
    val isRead: Boolean,
    val isIncoming: Boolean = true
)

/**
 * Encapsulates an active incoming notification.
 */
data class ActiveNotification(
    val id: String,
    val notificationKey: String,
    val notificationId: Int,
    val packageName: String,
    val appName: String,
    val sourceType: CommunicationSourceType,
    val sender: String,
    val title: String,
    val content: String,
    val timestamp: Long,
    val category: NotificationCategory = NotificationCategory.MESSAGES,
    val isGroup: Boolean = false,
    val groupTitle: String? = null,
    val replyAction: NotificationReplyAction? = null,
    val isRead: Boolean = false,
    val isSpoken: Boolean = false,
    val isProtected: Boolean = false,
    val subText: String? = null,
    val contentHash: Int = (title + content).hashCode()
) {
    val canDirectReply: Boolean get() = replyAction != null
}

/**
 * RemoteInput reply action extracted from Android notification actions.
 */
data class NotificationReplyAction(
    val title: String,
    val pendingIntent: PendingIntent,
    val remoteInput: RemoteInput,
    val resultKey: String
)

/**
 * Parsed Communication Action Types for Natural Language Commands.
 */
enum class CommunicationActionType {
    READ_NOTIFICATIONS,
    READ_APP_NOTIFICATIONS,
    READ_LAST_NOTIFICATION,
    SEARCH_NOTIFICATION,
    REPLY_TO_NOTIFICATION,
    NEXT_NOTIFICATION,

    READ_SMS,
    READ_LAST_SMS,
    SEARCH_SMS,
    COMPOSE_SMS,
    MODIFY_SMS_DRAFT,
    CONFIRM_SMS,
    CANCEL_SMS,

    SEARCH_CONTACT,
    CALL_CONTACT,
    GET_CONTACT_PHONE,
    RESOLVE_HOMONYM,

    SUMMARIZE_NOTIFICATIONS,
    CLEAR_CONTEXT,
    UNKNOWN
}

/**
 * Execution status for Communication actions.
 */
enum class CommunicationResultStatus {
    SUCCESS,
    REQUIRES_CONFIRMATION,
    REQUIRES_HOMONYM_CHOICE,
    REQUIRES_DRAFT_MODIFICATION,
    PERMISSION_REQUIRED,
    CONTACT_NOT_FOUND,
    AMBIGUOUS_CONTACT,
    NO_DATA,
    SEND_FAILED,
    REPLY_FAILED,
    CANCELLED,
    NOT_SUPPORTED,
    FAILED
}

/**
 * Result returned by communication actions with human voice response and metadata.
 */
data class CommunicationActionResult(
    val status: CommunicationResultStatus,
    val spokenMessage: String,
    val actionType: CommunicationActionType,
    val details: Map<String, Any?> = emptyMap(),
    val error: String? = null,
    val permissionNeeded: String? = null
) {
    val isSuccess: Boolean get() = status == CommunicationResultStatus.SUCCESS
}

/**
 * Contact record with identity and phone information.
 */
data class ContactRecord(
    val id: String,
    val displayName: String,
    val phoneNumber: String,
    val rawNumber: String = phoneNumber,
    val photoUri: String? = null,
    val accountType: String? = null
)

/**
 * Result of resolving a contact name query: exact match, homonyms, or not found.
 */
sealed class ContactResolutionResult {
    data class ExactMatch(val contact: ContactRecord) : ContactResolutionResult()
    data class Homonyms(val contacts: List<ContactRecord>, val query: String) : ContactResolutionResult()
    data class NotFound(val query: String) : ContactResolutionResult()
}

/**
 * Pending SMS draft waiting for modification or final voice confirmation.
 */
data class PendingSmsDraft(
    val id: String,
    val recipientQuery: String,
    val targetName: String,
    val phoneNumber: String,
    val messageBody: String,
    val isAwaitingModification: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Pending Notification reply waiting for confirmation.
 */
data class PendingNotificationReply(
    val id: String,
    val notificationKey: String,
    val targetSender: String,
    val appName: String,
    val replyText: String,
    val replyAction: NotificationReplyAction,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Generic confirmation container for sensitive actions.
 */
data class CommunicationConfirmation(
    val id: String,
    val prompt: String,
    val actionType: CommunicationActionType,
    val targetDescription: String,
    val executeAction: suspend () -> CommunicationActionResult,
    val onCancel: (suspend () -> Unit)? = null
)
