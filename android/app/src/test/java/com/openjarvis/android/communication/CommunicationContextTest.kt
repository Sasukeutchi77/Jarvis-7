package com.openjarvis.android.communication

import com.openjarvis.android.communication.context.CommunicationContext
import com.openjarvis.android.communication.model.ActiveNotification
import com.openjarvis.android.communication.model.ContactRecord
import com.openjarvis.android.communication.model.NotificationCategory
import com.openjarvis.android.communication.model.PendingSmsDraft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CommunicationContextTest {

    private lateinit var context: CommunicationContext

    @Before
    fun setUp() {
        context = CommunicationContext()
    }

    @Test
    fun testUpdateSenderContext() {
        context.updateSenderContext(
            sender = "Alice",
            packageName = "com.whatsapp",
            appName = "WhatsApp",
            notificationKey = "key_123"
        )

        assertEquals("Alice", context.lastSender.value)
        assertEquals("WhatsApp", context.lastApplication.value)
        assertEquals("key_123", context.lastNotificationKey.value)
        assertTrue(context.isSenderContextValid())
    }

    @Test
    fun testActiveBatchNavigation() {
        val notifs = listOf(
            ActiveNotification("1", 1, "com.whatsapp", "WhatsApp", "Alice", "Salut !", 1000L, NotificationCategory.MESSAGE),
            ActiveNotification("2", 2, "org.telegram.messenger", "Telegram", "Bob", "Hello JARVIS", 1001L, NotificationCategory.MESSAGE),
            ActiveNotification("3", 3, "com.google.android.apps.messaging", "Messages", "Charlie", "RDV à 14h", 1002L, NotificationCategory.SMS)
        )

        context.setActiveBatch(notifs)
        assertEquals(3, context.getRemainingBatchCount())

        val first = context.popNextInBatch()
        assertNotNull(first)
        assertEquals("Alice", first?.sender)
        assertEquals(2, context.getRemainingBatchCount())

        val second = context.popNextInBatch()
        assertEquals("Bob", second?.sender)
        assertEquals(1, context.getRemainingBatchCount())
    }

    @Test
    fun testPendingSmsDraft() {
        val draft = PendingSmsDraft(
            id = "draft_1",
            targetName = "Paul",
            phoneNumber = "+33612345678",
            messageBody = "Je suis en route."
        )

        context.setPendingSmsDraft(draft)
        val retrieved = context.getPendingSmsDraft()
        assertNotNull(retrieved)
        assertEquals("Paul", retrieved?.targetName)
        assertEquals("Je suis en route.", retrieved?.messageBody)

        context.clearPendingSmsDraft()
        assertNull(context.getPendingSmsDraft())
    }

    @Test
    fun testPendingHomonyms() {
        val homonyms = listOf(
            ContactRecord("1", "Paul Martin", "+33600000001", "Mobile"),
            ContactRecord("2", "Paul Dupont", "+33600000002", "Travail")
        )

        context.setPendingHomonyms(homonyms)
        val retrieved = context.getPendingHomonyms()
        assertEquals(2, retrieved.size)
        assertEquals("Paul Martin", retrieved[0].displayName)

        context.clearPendingHomonyms()
        assertTrue(context.getPendingHomonyms().isEmpty())
    }
}
