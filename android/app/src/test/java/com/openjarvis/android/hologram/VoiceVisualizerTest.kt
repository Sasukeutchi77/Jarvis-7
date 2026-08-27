package com.openjarvis.android.hologram

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class VoiceVisualizerTest {

    private lateinit var visualizer: VoiceVisualizer

    @Before
    fun setUp() {
        visualizer = VoiceVisualizer()
    }

    @Test
    fun testInitialState() {
        assertEquals(0.0f, visualizer.smoothedAmplitude, 0.001f)
        assertEquals(0.0f, visualizer.peakAmplitude, 0.001f)
        assertEquals(0.0f, visualizer.energyPulse, 0.001f)
        assertEquals(16, visualizer.frequencyBands.size)
    }

    @Test
    fun testProcessMicrophoneLevel() {
        // -60 dB is minimum threshold -> normalized should be near 0
        visualizer.processMicrophoneLevel(-60f)
        assertTrue(visualizer.smoothedAmplitude >= 0.0f)

        // -10 dB is strong speech -> amplitude should increase
        visualizer.processMicrophoneLevel(-10f)
        assertTrue(visualizer.smoothedAmplitude > 0.1f)
        assertTrue(visualizer.peakAmplitude > 0.1f)
    }

    @Test
    fun testProcessNormalizedEnergy() {
        visualizer.processNormalizedEnergy(0.85f)
        assertTrue(visualizer.smoothedAmplitude > 0.3f)
        assertTrue(visualizer.energyPulse > 0.5f)

        val coreScale = visualizer.calculateCoreScale()
        assertTrue("Core scale must expand with high energy", coreScale > 1.0f)
    }

    @Test
    fun testUpdateFrameSmoothHarmonics() {
        visualizer.processNormalizedEnergy(0.7f)
        visualizer.updateFrame(0.016f, true)

        var totalEnergy = 0.0f
        for (band in visualizer.frequencyBands) {
            assertTrue("Band must be clamped between 0 and 1", band in 0.0f..1.0f)
            totalEnergy += band
        }
        assertTrue("Frequency bands must react to energy", totalEnergy > 0.5f)
    }

    @Test
    fun testSpeedMultiplierAcrossStates() {
        val thinkingSpeed = visualizer.calculateSpeedMultiplier(HologramState.THINKING)
        val idleSpeed = visualizer.calculateSpeedMultiplier(HologramState.IDLE)
        val hiddenSpeed = visualizer.calculateSpeedMultiplier(HologramState.HIDDEN)

        assertTrue(thinkingSpeed > idleSpeed)
        assertEquals(0.0f, hiddenSpeed, 0.001f)
    }

    @Test
    fun testReset() {
        visualizer.processNormalizedEnergy(1.0f)
        visualizer.reset()
        assertEquals(0.0f, visualizer.smoothedAmplitude, 0.001f)
        assertEquals(0.0f, visualizer.peakAmplitude, 0.001f)
    }
}
