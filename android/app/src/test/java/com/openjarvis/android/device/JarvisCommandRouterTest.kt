package com.openjarvis.android.device

import com.openjarvis.android.device.model.ActionSecurityLevel
import com.openjarvis.android.device.model.DeviceActionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class JarvisCommandRouterTest {

    private lateinit var router: JarvisCommandRouter

    @Before
    fun setUp() {
        router = JarvisCommandRouter()
    }

    @Test
    fun testOpenAppRouting() {
        val intent1 = router.parse("ouvre WhatsApp")
        assertEquals(DeviceActionType.OPEN_APP, intent1.actionType)
        assertEquals(ActionSecurityLevel.SAFE_ACTION, intent1.securityLevel)
        assertEquals("WhatsApp", intent1.primaryParam)

        val intent2 = router.parse("lance YouTube")
        assertEquals(DeviceActionType.OPEN_APP, intent2.actionType)
        assertEquals("YouTube", intent2.primaryParam)

        val intent3 = router.parse("démarre Spotify")
        assertEquals(DeviceActionType.OPEN_APP, intent3.actionType)
        assertEquals("Spotify", intent3.primaryParam)
    }

    @Test
    fun testBatteryStatusRouting() {
        val intent1 = router.parse("JARVIS, combien me reste-t-il de batterie ?")
        assertEquals(DeviceActionType.BATTERY, intent1.actionType)
        assertEquals(ActionSecurityLevel.SAFE_ACTION, intent1.securityLevel)

        val intent2 = router.parse("niveau de batterie")
        assertEquals(DeviceActionType.BATTERY, intent2.actionType)

        val intent3 = router.parse("état de la batterie")
        assertEquals(DeviceActionType.BATTERY, intent3.actionType)
    }

    @Test
    fun testFlashlightRouting() {
        val onIntent = router.parse("allume la lampe")
        assertEquals(DeviceActionType.FLASHLIGHT, onIntent.actionType)
        assertEquals(true, onIntent.booleanFlag)

        val offIntent = router.parse("éteins la torche")
        assertEquals(DeviceActionType.FLASHLIGHT, offIntent.actionType)
        assertEquals(false, offIntent.booleanFlag)

        val flashIntent = router.parse("active le flash")
        assertEquals(DeviceActionType.FLASHLIGHT, flashIntent.actionType)
        assertEquals(true, flashIntent.booleanFlag)
    }

    @Test
    fun testVolumeRouting() {
        val incIntent = router.parse("augmente le volume")
        assertEquals(DeviceActionType.VOLUME, incIntent.actionType)
        assertEquals("increase", incIntent.primaryParam)

        val decIntent = router.parse("baisse le volume")
        assertEquals(DeviceActionType.VOLUME, decIntent.actionType)
        assertEquals("decrease", decIntent.primaryParam)

        val setIntent = router.parse("mets le volume à 50 %")
        assertEquals(DeviceActionType.VOLUME, setIntent.actionType)
        assertEquals("set", setIntent.primaryParam)
        assertEquals(50, setIntent.numericValue)

        val muteIntent = router.parse("coupe le son")
        assertEquals(DeviceActionType.VOLUME, muteIntent.actionType)
        assertEquals("mute", muteIntent.primaryParam)

        val unmuteIntent = router.parse("remets le son")
        assertEquals(DeviceActionType.VOLUME, unmuteIntent.actionType)
        assertEquals("unmute", unmuteIntent.primaryParam)
    }

    @Test
    fun testBrightnessRouting() {
        val incIntent = router.parse("augmente la luminosité")
        assertEquals(DeviceActionType.BRIGHTNESS, incIntent.actionType)
        assertEquals("increase", incIntent.primaryParam)

        val decIntent = router.parse("baisse la luminosité")
        assertEquals(DeviceActionType.BRIGHTNESS, decIntent.actionType)
        assertEquals("decrease", decIntent.primaryParam)

        val setIntent = router.parse("mets la luminosité à 70 %")
        assertEquals(DeviceActionType.BRIGHTNESS, setIntent.actionType)
        assertEquals("set", setIntent.primaryParam)
        assertEquals(70, setIntent.numericValue)
    }

    @Test
    fun testCameraRouting() {
        val camIntent = router.parse("ouvre la caméra")
        assertEquals(DeviceActionType.CAMERA, camIntent.actionType)
        assertEquals("photo", camIntent.primaryParam)

        val photoIntent = router.parse("lance l'appareil photo")
        assertEquals(DeviceActionType.CAMERA, photoIntent.actionType)
        assertEquals("photo", photoIntent.primaryParam)

        val videoIntent = router.parse("lance l'enregistreur vidéo")
        assertEquals(DeviceActionType.CAMERA, videoIntent.actionType)
        assertEquals("video", videoIntent.primaryParam)
    }

    @Test
    fun testPhoneCallRoutingSensitive() {
        val call1 = router.parse("appelle Paul")
        assertEquals(DeviceActionType.PHONE_CALL, call1.actionType)
        assertEquals(ActionSecurityLevel.SENSITIVE_ACTION, call1.securityLevel)
        assertEquals("Paul", call1.primaryParam)

        val call2 = router.parse("compose le 0612345678")
        assertEquals(DeviceActionType.PHONE_CALL, call2.actionType)
        assertEquals(ActionSecurityLevel.SENSITIVE_ACTION, call2.securityLevel)
        assertEquals("0612345678", call2.primaryParam)
    }

    @Test
    fun testSmsRoutingSensitive() {
        val sms1 = router.parse("écris à Paul : je serai en retard")
        assertEquals(DeviceActionType.SMS, sms1.actionType)
        assertEquals(ActionSecurityLevel.SENSITIVE_ACTION, sms1.securityLevel)
        assertEquals("Paul", sms1.primaryParam)
        assertEquals("je serai en retard", sms1.secondaryParam)

        val sms2 = router.parse("envoie un sms à Marie disant bonjour je passe bientôt")
        assertEquals(DeviceActionType.SMS, sms2.actionType)
        assertEquals(ActionSecurityLevel.SENSITIVE_ACTION, sms2.securityLevel)
        assertEquals("Marie", sms2.primaryParam)
        assertEquals("bonjour je passe bientôt", sms2.secondaryParam)

        val openSms = router.parse("ouvre les SMS")
        assertEquals(DeviceActionType.SMS, openSms.actionType)
        assertEquals(ActionSecurityLevel.SAFE_ACTION, openSms.securityLevel)
        assertEquals("open_app", openSms.primaryParam)
    }

    @Test
    fun testNavigationAndLockRouting() {
        val homeIntent = router.parse("retourne à l'accueil")
        assertEquals(DeviceActionType.NAVIGATION, homeIntent.actionType)
        assertEquals("home", homeIntent.primaryParam)

        val recentsIntent = router.parse("applications récentes")
        assertEquals(DeviceActionType.NAVIGATION, recentsIntent.actionType)
        assertEquals("recents", recentsIntent.primaryParam)

        val lockIntent = router.parse("verrouille mon téléphone")
        assertEquals(DeviceActionType.LOCK_DEVICE, lockIntent.actionType)
    }

    @Test
    fun testSettingsAndTogglesRouting() {
        val setGen = router.parse("ouvre les paramètres")
        assertEquals(DeviceActionType.SETTINGS, setGen.actionType)

        val setWifi = router.parse("ouvre les paramètres Wi-Fi")
        assertEquals(DeviceActionType.SETTINGS, setWifi.actionType)

        val btOn = router.parse("active le Bluetooth")
        assertEquals(DeviceActionType.BLUETOOTH, btOn.actionType)
        assertEquals(true, btOn.booleanFlag)

        val wifiOff = router.parse("désactive le Wi-Fi")
        assertEquals(DeviceActionType.WIFI, wifiOff.actionType)
        assertEquals(false, wifiOff.booleanFlag)
    }

    @Test
    fun testConfirmationAndCancellationReplies() {
        val yes1 = router.parse("oui")
        assertTrue(yes1.isConfirmationResponse)
        assertFalse(yes1.isCancellationResponse)

        val yes2 = router.parse("confirmer")
        assertTrue(yes2.isConfirmationResponse)

        val no1 = router.parse("non")
        assertTrue(no1.isCancellationResponse)
        assertFalse(no1.isConfirmationResponse)

        val no2 = router.parse("annule")
        assertTrue(no2.isCancellationResponse)
    }
}
