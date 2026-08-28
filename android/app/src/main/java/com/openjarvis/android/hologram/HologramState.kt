package com.openjarvis.android.hologram

import androidx.compose.ui.graphics.Color

/**
 * Lifecycle states of the JARVIS Floating Holographic Interface.
 * Cycle: HIDDEN -> APPEARING -> IDLE / LISTENING -> THINKING -> SPEAKING -> DISMISSING -> HIDDEN
 */
enum class HologramState {
    /**
     * Interface is completely dormant and not rendering on screen.
     */
    HIDDEN,

    /**
     * Entry animation: expanding from a focal quantum particle to orbital reactor rings (300–800ms).
     */
    APPEARING,

    /**
     * Idle standby: subtle rotational drift, faint particle breathing, low-power mode.
     */
    IDLE,

    /**
     * Actively listening to user voice: rings expand dynamically with microphone amplitude.
     */
    LISTENING,

    /**
     * Core AI processing: fast orbital ring rotation, particle acceleration, calculation flux.
     */
    THINKING,

    /**
     * Memory Core retrieval / encoding state: synaptic particle pulse & neural data flow rings.
     */
    MEMORY,

    /**
     * Vocal response synthesis: core pulsation and harmonic wave reacting to TTS output.
     */
    SPEAKING,

    /**
     * Exit transition: collapse toward center, fading particles, returning to HIDDEN.
     */
    DISMISSING;

    val isVisible: Boolean
        get() = this != HIDDEN

    val isAnimating: Boolean
        get() = this != HIDDEN
}

/**
 * Rendering quality levels for battery and GPU optimization.
 */
enum class HologramQuality {
    HIGH,   // 60 FPS, multi-ring shaders, dense particle system (40 particles), glow passes
    MEDIUM, // 45-60 FPS, standard rings, 20 particles, single glow pass
    LOW     // 30 FPS, simplified geometry, 8 particles, minimal blur/glow
}

/**
 * Futuristic Holographic Color Palettes.
 */
enum class HologramThemeColor(
    val displayName: String,
    val primaryHex: Long,
    val secondaryHex: Long,
    val accentHex: Long
) {
    CYBER_CYAN(
        displayName = "Cyber Cyan (JARVIS Classic)",
        primaryHex = 0xFF0284C7,
        secondaryHex = 0xFF38BDF8,
        accentHex = 0xFFE0F2FE
    ),
    ARC_BLUE(
        displayName = "Arc Reactor Blue (Stark Edition)",
        primaryHex = 0xFF2563EB,
        secondaryHex = 0xFF60A5FA,
        accentHex = 0xFF93C5FD
    ),
    STARK_GOLD(
        displayName = "Golden Mark XLVII",
        primaryHex = 0xFFD97706,
        secondaryHex = 0xFFFBBF24,
        accentHex = 0xFFFEF3C7
    ),
    QUANTUM_EMERALD(
        displayName = "Quantum Emerald",
        primaryHex = 0xFF059669,
        secondaryHex = 0xFF34D399,
        accentHex = 0xFFD1FAE5
    ),
    TACTICAL_CRIMSON(
        displayName = "Tactical Crimson",
        primaryHex = 0xFFDC2626,
        secondaryHex = 0xFFF87171,
        accentHex = 0xFFFEE2E2
    );

    val primaryColor: Color get() = Color(primaryHex)
    val secondaryColor: Color get() = Color(secondaryHex)
    val accentColor: Color get() = Color(accentHex)

    val primaryInt: Int get() = primaryHex.toInt()
    val secondaryInt: Int get() = secondaryHex.toInt()
    val accentInt: Int get() = accentHex.toInt()
}

/**
 * Configuration payload for the Hologram subsystem.
 */
data class HologramConfig(
    val enabled: Boolean = true,
    val overlayEnabled: Boolean = true,
    val themeColor: HologramThemeColor = HologramThemeColor.CYBER_CYAN,
    val quality: HologramQuality = HologramQuality.HIGH,
    val autoHide: Boolean = true,
    val autoHideDelaySec: Int = 4,
    val hapticFeedbackEnabled: Boolean = true,
    val activationSoundEnabled: Boolean = true,
    val appearanceDurationMs: Long = 450L,
    val dismissDurationMs: Long = 350L,
    val initialScale: Float = 1.0f,
    val lockScreenAllowed: Boolean = false
)
