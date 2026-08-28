package com.openjarvis.android.device

import com.openjarvis.android.device.history.JarvisActionHistory
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class JarvisActionHistoryTest {

    @Before
    fun setUp() {
        JarvisActionHistory.clear()
    }

    @Test
    fun testRecordAndRetrieveHistory() {
        JarvisActionHistory.record(
            command = "allume la lampe",
            actionType = DeviceActionType.FLASHLIGHT,
            status = ActionResultStatus.SUCCESS,
            message = "La lampe torche est allumée.",
            latencyMs = 12L
        )

        JarvisActionHistory.record(
            command = "combien de batterie ?",
            actionType = DeviceActionType.BATTERY,
            status = ActionResultStatus.SUCCESS,
            message = "Il vous reste 85 % de batterie.",
            latencyMs = 8L
        )

        val history = JarvisActionHistory.getAll()
        assertEquals(2, history.size)
        assertEquals("combien de batterie ?", history[0].command)
        assertEquals(DeviceActionType.BATTERY, history[0].actionType)
        assertEquals("allume la lampe", history[1].command)
        assertEquals(DeviceActionType.FLASHLIGHT, history[1].actionType)
    }

    @Test
    fun testHistoryClear() {
        JarvisActionHistory.record(
            command = "ouvre YouTube",
            actionType = DeviceActionType.OPEN_APP,
            status = ActionResultStatus.SUCCESS,
            message = "J'ouvre YouTube.",
            latencyMs = 25L
        )

        assertTrue(JarvisActionHistory.getAll().isNotEmpty())
        JarvisActionHistory.clear()
        assertTrue(JarvisActionHistory.getAll().isEmpty())
    }
}
