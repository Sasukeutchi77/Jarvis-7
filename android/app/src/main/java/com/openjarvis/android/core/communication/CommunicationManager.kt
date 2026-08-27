package com.openjarvis.android.core.communication

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.logging.JarvisLogger
import com.openjarvis.android.services.JarvisNotificationListenerService
import java.util.concurrent.CopyOnWriteArrayList

object CommunicationManager {
    private var listenerEnabled: Boolean = true
    private var autoRead: Boolean = false
    private var readOnlyImportant: Boolean = false
    private var readOnlyVip: Boolean = false
    private var silentMode: Boolean = false
    private var confirmBeforeSend: Boolean = true
    private var privateMode: Boolean = false

    private val protectedContacts = mutableSetOf<String>()
    private val protectedApps = mutableSetOf<String>()
    private val messagesHistory = CopyOnWriteArrayList<IncomingMessage>()

    fun isListenerEnabled(): Boolean = listenerEnabled
    fun setListenerEnabled(enabled: Boolean) { listenerEnabled = enabled }

    fun isPrivateMode(): Boolean = privateMode
    fun setPrivateMode(enabled: Boolean) { privateMode = enabled }

    fun isAutoRead(): Boolean = autoRead
    fun setAutoRead(enabled: Boolean) { autoRead = enabled }

    fun isReadOnlyImportant(): Boolean = readOnlyImportant
    fun setReadOnlyImportant(enabled: Boolean) { readOnlyImportant = enabled }

    fun isConfirmBeforeSend(): Boolean = confirmBeforeSend
    fun setConfirmBeforeSend(enabled: Boolean) { confirmBeforeSend = enabled }

    fun addProtectedContact(contact: String) { protectedContacts.add(contact.lowercase().trim()) }
    fun removeProtectedContact(contact: String) { protectedContacts.remove(contact.lowercase().trim()) }

    fun addProtectedApp(pkg: String) { protectedApps.add(pkg.lowercase().trim()) }
    fun removeProtectedApp(pkg: String) { protectedApps.remove(pkg.lowercase().trim()) }

    fun isProtectedContactOrApp(sender: String, pkg: String): Boolean {
        if (privateMode) return true
        if (protectedContacts.contains(sender.lowercase().trim())) return true
        if (protectedApps.contains(pkg.lowercase().trim())) return true
        return false
    }

    fun handleIncomingMessage(context: Context, message: IncomingMessage) {
        if (privateMode) {
            JarvisLogger.i("CommunicationManager", "Message received in Private Mode (no persistent logging)")
        } else {
            JarvisLogger.i("CommunicationManager", "New message received from [${message.appName}] ${message.sender}")
            messagesHistory.add(0, message)
            if (messagesHistory.size > 100) {
                messagesHistory.removeAt(messagesHistory.size - 1)
            }
        }

        // Emit notification / communication event
        val vocalAlert = if (message.isProtected) {
            "Monsieur, vous avez reçu un nouveau message d'un contact protégé sur ${message.appName}."
        } else {
            "Nouveau message de ${message.sender} sur ${message.appName} : ${message.content}"
        }

        JarvisEventBus.emit(JarvisEvent.SystemAlert(vocalAlert, "COMMUNICATION"))
    }

    fun getRecentMessages(): List<IncomingMessage> = messagesHistory.toList()

    fun markAsRead(id: String) {
        val index = messagesHistory.indexOfFirst { it.id == id }
        if (index >= 0) {
            val msg = messagesHistory[index]
            messagesHistory[index] = msg.copy(isRead = true)
        }
    }

    fun sendReply(context: Context, messageId: String, replyText: String): Boolean {
        val msg = messagesHistory.find { it.id == messageId } ?: return false
        val key = msg.notificationKey ?: return false

        val success = JarvisNotificationListenerService.sendDirectReply(context, key, replyText)
        if (success) {
            val index = messagesHistory.indexOfFirst { it.id == messageId }
            if (index >= 0) {
                messagesHistory[index] = msg.copy(
                    isRead = true,
                    repliedAt = System.currentTimeMillis(),
                    sentReplyText = replyText
                )
            }
        }
        return success
    }

    fun openConversationFallback(context: Context, packageName: String, contact: String? = null) {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
        } catch (e: Exception) {
            JarvisLogger.e("CommunicationManager", "Failed to launch package $packageName", e)
        }
    }
}
