package com.openjarvis.android.core.communication

import android.app.PendingIntent
import androidx.core.app.RemoteInput

enum class MessageCategory(val label: String, val emoji: String) {
    URGENT("Urgent", "🔴"),
    IMPORTANT("Important", "🟠"),
    TO_REPLY("À répondre", "🟡"),
    INFO("Information", "🟢"),
    OTHER("Autre", "⚪")
}

data class NotificationReplyAction(
    val title: String,
    val pendingIntent: PendingIntent,
    val remoteInput: RemoteInput,
    val resultKey: String
)

data class IncomingMessage(
    val id: String,
    val source: CommunicationSourceType,
    val packageName: String,
    val appName: String,
    val sender: String,
    val title: String,
    val content: String,
    val timestamp: Long,
    val conversationId: String? = null,
    val notificationKey: String? = null,
    val notificationId: Int = 0,
    val replyAvailable: Boolean = false,
    val category: MessageCategory = MessageCategory.INFO,
    val isGroup: Boolean = false,
    val groupTitle: String? = null,
    val isRead: Boolean = false,
    val isSpoken: Boolean = false,
    val isProtected: Boolean = false,
    val suggestedReply: String? = null,
    val repliedAt: Long? = null,
    val sentReplyText: String? = null,
    val isMemorized: Boolean = false,
    val metadata: Map<String, String> = emptyMap()
)
