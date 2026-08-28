package com.openjarvis.android.communication

import com.openjarvis.android.communication.model.CommunicationActionType
import com.openjarvis.android.communication.router.CommunicationCommandRouter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CommunicationCommandRouterTest {

    private lateinit var router: CommunicationCommandRouter

    @Before
    fun setUp() {
        router = CommunicationCommandRouter()
    }

    @Test
    fun testParseSmsComposition() {
        val intent1 = router.parse("écris à Paul : je serai en retard de 10 minutes")
        assertEquals(CommunicationActionType.COMPOSE_SMS, intent1.actionType)
        assertEquals("Paul", intent1.primaryTarget)
        assertEquals("je serai en retard de 10 minutes", intent1.secondaryContent)

        val intent2 = router.parse("envoie un SMS à Marie disant que je suis en route")
        assertEquals(CommunicationActionType.COMPOSE_SMS, intent2.actionType)
        assertEquals("Marie", intent2.primaryTarget)
        assertEquals("que je suis en route", intent2.secondaryContent)
    }

    @Test
    fun testParseReadSms() {
        val intent1 = router.parse("lis mes derniers SMS")
        assertEquals(CommunicationActionType.READ_SMS, intent1.actionType)

        val intent2 = router.parse("lis mon dernier SMS")
        assertEquals(CommunicationActionType.READ_LAST_SMS, intent2.actionType)

        val intent3 = router.parse("lis les SMS de Paul")
        assertEquals(CommunicationActionType.READ_SMS, intent3.actionType)
        assertEquals("Paul", intent3.primaryTarget)
    }

    @Test
    fun testParseNotifications() {
        val intent1 = router.parse("lis mes notifications")
        assertEquals(CommunicationActionType.READ_NOTIFICATIONS, intent1.actionType)

        val intent2 = router.parse("quelles sont mes notifications WhatsApp ?")
        assertEquals(CommunicationActionType.READ_APP_NOTIFICATIONS, intent2.actionType)
        assertEquals("WhatsApp", intent2.appFilter)

        val intent3 = router.parse("quelles sont mes notifications Telegram ?")
        assertEquals(CommunicationActionType.READ_APP_NOTIFICATIONS, intent3.actionType)
        assertEquals("Telegram", intent3.appFilter)

        val intent4 = router.parse("fais un résumé de mes notifications")
        assertEquals(CommunicationActionType.SUMMARIZE_NOTIFICATIONS, intent4.actionType)
    }

    @Test
    fun testParseReplies() {
        val intent1 = router.parse("réponds-lui : j'arrive tout de suite")
        assertEquals(CommunicationActionType.REPLY_TO_NOTIFICATION, intent1.actionType)
        assertEquals("j'arrive tout de suite", intent1.secondaryContent)

        val intent2 = router.parse("réponds à Paul : d'accord pour 19h")
        assertEquals(CommunicationActionType.REPLY_TO_NOTIFICATION, intent2.actionType)
        assertEquals("Paul", intent2.primaryTarget)
        assertEquals("d'accord pour 19h", intent2.secondaryContent)
    }

    @Test
    fun testConfirmationsAndCancellations() {
        val conf = router.parse("oui")
        assertTrue(conf.isConfirmation)

        val conf2 = router.parse("envoie le message")
        assertTrue(conf2.isConfirmation)

        val cancel = router.parse("non")
        assertTrue(cancel.isCancellation)

        val cancel2 = router.parse("ne l'envoie pas")
        assertTrue(cancel2.isCancellation)
    }

    @Test
    fun testDraftModifications() {
        val modif = router.parse("change le message en : je ne pourrai pas venir")
        assertEquals(CommunicationActionType.MODIFY_SMS_DRAFT, modif.actionType)
        assertTrue(modif.isModificationRequest)
        assertEquals("je ne pourrai pas venir", modif.secondaryContent)
    }

    @Test
    fun testHomonymSelection() {
        val hom1 = router.parse("le premier")
        assertEquals(CommunicationActionType.RESOLVE_HOMONYM, hom1.actionType)
        assertTrue(hom1.isHomonymSelection)

        val hom2 = router.parse("le 2")
        assertEquals(CommunicationActionType.RESOLVE_HOMONYM, hom2.actionType)
        assertTrue(hom2.isHomonymSelection)
    }
}
