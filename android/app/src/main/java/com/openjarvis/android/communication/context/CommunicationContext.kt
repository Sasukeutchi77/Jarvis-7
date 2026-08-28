package com.openjarvis.android.communication.context

import com.openjarvis.android.communication.model.ActiveNotification
import com.openjarvis.android.communication.model.ContactRecord
import com.openjarvis.android.communication.model.PendingNotificationReply
import com.openjarvis.android.communication.model.PendingSmsDraft
import com.openjarvis.android.communication.model.SmsRecord
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Temporary Context Manager for conversational communication interactions.
 * Safely holds context (last sender, last message, last app, pending draft) and expires
 * after a configurable TTL to protect user privacy.
 */
class CommunicationContext(
    var ttlMillis: Long = 5 * 60 * 1000L // 5 minutes default
) {
    private val _lastSender = MutableStateFlow<String?>(null)
    val lastSender: StateFlow<String?> = _lastSender.asStateFlow()

    private val _lastSenderNumber = MutableStateFlow<String?>(null)
    val lastSenderNumber: StateFlow<String?> = _lastSenderNumber.asStateFlow()

    private val _lastMessageContent = MutableStateFlow<String?>(null)
    val lastMessageContent: StateFlow<String?> = _lastMessageContent.asStateFlow()

    private val _lastApplication = MutableStateFlow<String?>(null)
    val lastApplication: StateFlow<String?> = _lastApplication.asStateFlow()

    private val _lastPackageName = MutableStateFlow<String?>(null)
    val lastPackageName: StateFlow<String?> = _lastPackageName.asStateFlow()

    private val _lastNotificationKey = MutableStateFlow<String?>(null)
    val lastNotificationKey: StateFlow<String?> = _lastNotificationKey.asStateFlow()

    private val _lastConversationId = MutableStateFlow<String?>(null)
    val lastConversationId: StateFlow<String?> = _lastConversationId.asStateFlow()

    private var lastUpdatedTimestamp: Long = 0L

    // Notification Reading Cursor
    private var cachedNotificationList: List<ActiveNotification> = emptyList()
    private var currentNotificationIndex: Int = -1

    // SMS Reading Cursor
    private var cachedSmsList: List<SmsRecord> = emptyList()
    private var currentSmsIndex: Int = -1

    // Active Pending Disambiguation / Drafts
    private var pendingHomonymChoices: List<ContactRecord> = emptyList()
    private var pendingHomonymQuery: String = ""

    private var activeSmsDraft: PendingSmsDraft? = null
    private var activeNotificationReplyDraft: PendingNotificationReply? = null

    /**
     * Check if context has expired.
     */
    fun isExpired(): Boolean {
        if (lastUpdatedTimestamp == 0L) return true
        return System.currentTimeMillis() - lastUpdatedTimestamp > ttlMillis
    }

    /**
     * Update conversational context from an active notification.
     */
    fun updateFromNotification(notification: ActiveNotification) {
        lastUpdatedTimestamp = System.currentTimeMillis()
        _lastSender.value = notification.sender
        _lastMessageContent.value = notification.content
        _lastApplication.value = notification.appName
        _lastPackageName.value = notification.packageName
        _lastNotificationKey.value = notification.notificationKey
        _lastConversationId.value = notification.groupTitle ?: notification.sender
        JarvisLogger.d("CommunicationContext", "Context updated from notification: ${notification.sender} (${notification.appName})")
    }

    /**
     * Update conversational context from an SMS.
     */
    fun updateFromSms(sms: SmsRecord) {
        lastUpdatedTimestamp = System.currentTimeMillis()
        _lastSender.value = sms.contactName ?: sms.address
        _lastSenderNumber.value = sms.address
        _lastMessageContent.value = sms.body
        _lastApplication.value = "SMS"
        _lastPackageName.value = "com.google.android.apps.messaging"
        _lastNotificationKey.value = null
        _lastConversationId.value = sms.threadId
        JarvisLogger.d("CommunicationContext", "Context updated from SMS: ${_lastSender.value}")
    }

    /**
     * Sets cached notification reading list and resets cursor.
     */
    fun setNotificationList(list: List<ActiveNotification>) {
        cachedNotificationList = list
        currentNotificationIndex = if (list.isNotEmpty()) 0 else -1
        if (list.isNotEmpty()) {
            updateFromNotification(list[0])
        }
    }

    /**
     * Advance to the next unread/cached notification.
     */
    fun getNextNotification(): ActiveNotification? {
        if (cachedNotificationList.isEmpty()) return null
        val nextIdx = currentNotificationIndex + 1
        return if (nextIdx < cachedNotificationList.size) {
            currentNotificationIndex = nextIdx
            val notif = cachedNotificationList[nextIdx]
            updateFromNotification(notif)
            notif
        } else {
            null
        }
    }

    fun getCurrentNotification(): ActiveNotification? {
        return if (currentNotificationIndex in cachedNotificationList.indices) {
            cachedNotificationList[currentNotificationIndex]
        } else {
            null
        }
    }

    /**
     * Sets cached SMS reading list and resets cursor.
     */
    fun setSmsList(list: List<SmsRecord>) {
        cachedSmsList = list
        currentSmsIndex = if (list.isNotEmpty()) 0 else -1
        if (list.isNotEmpty()) {
            updateFromSms(list[0])
        }
    }

    /**
     * Advance to the next unread/cached SMS.
     */
    fun getNextSms(): SmsRecord? {
        if (cachedSmsList.isEmpty()) return null
        val nextIdx = currentSmsIndex + 1
        return if (nextIdx < cachedSmsList.size) {
            currentSmsIndex = nextIdx
            val sms = cachedSmsList[nextIdx]
            updateFromSms(sms)
            sms
        } else {
            null
        }
    }

    fun getCurrentSms(): SmsRecord? {
        return if (currentSmsIndex in cachedSmsList.indices) {
            cachedSmsList[currentSmsIndex]
        } else {
            null
        }
    }

    /**
     * Get effective sender from active context if valid and unexpired.
     */
    fun getEffectiveSender(): String? {
        if (isExpired()) return null
        return _lastSender.value
    }

    fun getEffectivePackageName(): String? {
        if (isExpired()) return null
        return _lastPackageName.value
    }

    fun getEffectiveNotificationKey(): String? {
        if (isExpired()) return null
        return _lastNotificationKey.value
    }

    // Pending Homonyms
    fun setPendingHomonyms(query: String, homonyms: List<ContactRecord>) {
        lastUpdatedTimestamp = System.currentTimeMillis()
        pendingHomonymQuery = query
        pendingHomonymChoices = homonyms
    }

    fun getPendingHomonyms(): List<ContactRecord> = pendingHomonymChoices
    fun getPendingHomonymQuery(): String = pendingHomonymQuery

    fun clearPendingHomonyms() {
        pendingHomonymChoices = emptyList()
        pendingHomonymQuery = ""
    }

    // Pending SMS Draft
    fun setPendingSmsDraft(draft: PendingSmsDraft) {
        lastUpdatedTimestamp = System.currentTimeMillis()
        activeSmsDraft = draft
    }

    fun getPendingSmsDraft(): PendingSmsDraft? = activeSmsDraft

    fun clearPendingSmsDraft() {
        activeSmsDraft = null
    }

    // Pending Notification Reply Draft
    fun setPendingNotificationReply(reply: PendingNotificationReply) {
        lastUpdatedTimestamp = System.currentTimeMillis()
        activeNotificationReplyDraft = reply
    }

    fun getPendingNotificationReply(): PendingNotificationReply? = activeNotificationReplyDraft

    fun clearPendingNotificationReply() {
        activeNotificationReplyDraft = null
    }

    /**
     * Securely clear all temporary conversational context and drafts.
     */
    fun clear() {
        _lastSender.value = null
        _lastSenderNumber.value = null
        _lastMessageContent.value = null
        _lastApplication.value = null
        _lastPackageName.value = null
        _lastNotificationKey.value = null
        _lastConversationId.value = null
        lastUpdatedTimestamp = 0L

        cachedNotificationList = emptyList()
        currentNotificationIndex = -1
        cachedSmsList = emptyList()
        currentSmsIndex = -1

        clearPendingHomonyms()
        clearPendingSmsDraft()
        clearPendingNotificationReply()

        JarvisLogger.i("CommunicationContext", "Communication Context cleared for privacy.")
    }
}
