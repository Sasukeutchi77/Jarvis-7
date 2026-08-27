package com.openjarvis.android.voice.wakeword

/**
 * Phonetic Acoustic State in the Wake-Word Markov/Template Sequence.
 * Represents expected formant frequencies and MFCC profile for a phoneme segment.
 */
data class PhoneticState(
    val name: String,
    val expectedMfcc: FloatArray,
    val weight: Float = 1.0f,
    val minFrames: Int = 3,
    val maxFrames: Int = 20,
    val minFricativeEnergy: Float = 0f,
    val minVoicingEnergy: Float = 0f
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PhoneticState) return false
        return name == other.name && expectedMfcc.contentEquals(other.expectedMfcc)
    }

    override fun hashCode(): Int {
        var result = name.hashCode()
        result = 31 * result + expectedMfcc.contentHashCode()
        return result
    }
}

/**
 * Acoustic Template Model for a Wake-Word phrase.
 * Holds sequence of phonetic states, temporal constraints, and negative rejection anchors.
 */
data class WakeWordModel(
    val id: String,
    val phrase: String,
    val language: String,
    val sampleRate: Int = 16000,
    val totalExpectedFrames: Int = 90, // ~900ms duration at 10ms frame shift
    val phoneticStates: List<PhoneticState>,
    val negativePatterns: List<List<FloatArray>> = emptyList()
) {
    companion object {
        private const val MFCC_DIM = 13

        /**
         * Standard Acoustic Model for "Hey JARVIS" (/h eɪ  dʒ ɑː r v ɪ s/).
         * Acoustic State Sequence:
         * 1. /h/  - Unvoiced glottal fricative (high spectral spread, low energy)
         * 2. /eɪ/ - Diphthong front vowel (high mid-cepstral energy, F1~500Hz, F2~2100Hz)
         * 3. /dʒ/ - Voiced postalveolar affricate (short silence + release burst)
         * 4. /ɑː/ - Open back unrounded vowel (high F1 ~750Hz, mid F2 ~1100Hz)
         * 5. /r/  - Post-alveolar approximant / rhotic formant transition (F3 dip ~1700Hz)
         * 6. /v/  - Voiced labiodental fricative (voicing bar + mid-high turbulence)
         * 7. /ɪ/  - Near-close near-front vowel (F2 ~2000Hz)
         * 8. /s/  - Voiceless alveolar sibilant fricative (high frequency energy > 4.5kHz)
         */
        val HEY_JARVIS: WakeWordModel by lazy {
            createHeyJarvisModel()
        }

        /**
         * French Acoustic Model for "Dis JARVIS" (/d i  ʒ a ʁ v i s/).
         */
        val DIS_JARVIS: WakeWordModel by lazy {
            createDisJarvisModel()
        }

        /**
         * Universal WakeWordModel registry.
         */
        fun getModelForPhrase(phrase: String): WakeWordModel {
            val norm = phrase.trim().lowercase()
            return when {
                norm.contains("dis") -> DIS_JARVIS
                norm.contains("ok") || norm.contains("salut") || norm.contains("bonjour") -> createCustomModel(phrase)
                else -> HEY_JARVIS
            }
        }

        private fun createHeyJarvisModel(): WakeWordModel {
            val states = listOf(
                // 1. /h/ - Glottal onset
                PhoneticState(
                    name = "H",
                    expectedMfcc = floatArrayOf(-1.8f, 0.4f, -0.6f, 0.2f, -0.3f, 0.1f, -0.2f, 0.1f, -0.1f, 0.0f, 0.1f, 0.0f, 0.0f),
                    weight = 0.9f,
                    minFrames = 2,
                    maxFrames = 10
                ),
                // 2. /eɪ/ - Diphthong "EY"
                PhoneticState(
                    name = "EY",
                    expectedMfcc = floatArrayOf(2.2f, 1.4f, -0.8f, 0.9f, -0.5f, 0.4f, -0.3f, 0.2f, -0.1f, 0.2f, -0.1f, 0.1f, 0.0f),
                    weight = 1.2f,
                    minFrames = 6,
                    maxFrames = 22,
                    minVoicingEnergy = 0.25f
                ),
                // 3. /dʒ/ - Affricate "J"
                PhoneticState(
                    name = "JH",
                    expectedMfcc = floatArrayOf(0.6f, -0.5f, 1.1f, -0.4f, 0.8f, -0.3f, 0.4f, -0.2f, 0.3f, -0.1f, 0.2f, 0.0f, -0.1f),
                    weight = 1.3f,
                    minFrames = 3,
                    maxFrames = 12
                ),
                // 4. /ɑː/ - Open vowel "AA"
                PhoneticState(
                    name = "AA",
                    expectedMfcc = floatArrayOf(2.4f, 1.8f, 0.6f, -0.7f, -0.9f, 0.3f, -0.2f, 0.1f, -0.3f, 0.0f, -0.1f, 0.1f, 0.0f),
                    weight = 1.3f,
                    minFrames = 6,
                    maxFrames = 20,
                    minVoicingEnergy = 0.30f
                ),
                // 5. /r/ - Rhotic "R"
                PhoneticState(
                    name = "R",
                    expectedMfcc = floatArrayOf(1.2f, 0.9f, -0.4f, -0.6f, 0.5f, -0.4f, 0.1f, -0.3f, 0.2f, -0.1f, 0.0f, 0.1f, -0.1f),
                    weight = 1.0f,
                    minFrames = 3,
                    maxFrames = 14
                ),
                // 6. /v/ - Fricative "V"
                PhoneticState(
                    name = "V",
                    expectedMfcc = floatArrayOf(0.4f, 0.2f, -0.3f, 0.5f, -0.2f, 0.4f, -0.3f, 0.2f, -0.2f, 0.1f, -0.1f, 0.0f, 0.0f),
                    weight = 1.1f,
                    minFrames = 3,
                    maxFrames = 12
                ),
                // 7. /ɪ/ - Near-close "IH"
                PhoneticState(
                    name = "IH",
                    expectedMfcc = floatArrayOf(1.8f, 1.1f, -0.9f, 0.8f, -0.4f, 0.3f, -0.2f, 0.1f, -0.1f, 0.1f, 0.0f, 0.1f, 0.0f),
                    weight = 1.1f,
                    minFrames = 4,
                    maxFrames = 16,
                    minVoicingEnergy = 0.20f
                ),
                // 8. /s/ - Sibilant "S"
                PhoneticState(
                    name = "S",
                    expectedMfcc = floatArrayOf(0.2f, -1.8f, 1.4f, -1.2f, 1.1f, -0.9f, 0.8f, -0.7f, 0.6f, -0.5f, 0.4f, -0.3f, 0.2f),
                    weight = 1.4f,
                    minFrames = 5,
                    maxFrames = 18,
                    minFricativeEnergy = 0.35f
                )
            )

            return WakeWordModel(
                id = "model_hey_jarvis_v2",
                phrase = "Hey JARVIS",
                language = "en-US / fr-FR",
                totalExpectedFrames = 85,
                phoneticStates = states
            )
        }

        private fun createDisJarvisModel(): WakeWordModel {
            val states = listOf(
                // 1. /d/ - Plosive
                PhoneticState(
                    name = "D",
                    expectedMfcc = floatArrayOf(0.5f, 0.3f, -0.5f, 0.3f, -0.2f, 0.2f, -0.1f, 0.1f, -0.1f, 0.0f, 0.0f, 0.0f, 0.0f),
                    weight = 1.0f,
                    minFrames = 2,
                    maxFrames = 8
                ),
                // 2. /i/ - High front vowel
                PhoneticState(
                    name = "IY",
                    expectedMfcc = floatArrayOf(2.3f, 1.5f, -1.1f, 1.0f, -0.6f, 0.5f, -0.4f, 0.2f, -0.2f, 0.1f, -0.1f, 0.1f, 0.0f),
                    weight = 1.2f,
                    minFrames = 5,
                    maxFrames = 18,
                    minVoicingEnergy = 0.25f
                ),
                // 3. /ʒ/ - Voiced postalveolar fricative
                PhoneticState(
                    name = "ZH",
                    expectedMfcc = floatArrayOf(0.8f, -0.6f, 0.9f, -0.5f, 0.7f, -0.4f, 0.3f, -0.2f, 0.2f, -0.1f, 0.1f, 0.0f, -0.1f),
                    weight = 1.2f,
                    minFrames = 4,
                    maxFrames = 14
                ),
                // 4. /a/ - Open front vowel
                PhoneticState(
                    name = "AA",
                    expectedMfcc = floatArrayOf(2.5f, 1.9f, 0.5f, -0.8f, -0.8f, 0.3f, -0.2f, 0.1f, -0.2f, 0.0f, -0.1f, 0.1f, 0.0f),
                    weight = 1.3f,
                    minFrames = 6,
                    maxFrames = 20,
                    minVoicingEnergy = 0.30f
                ),
                // 5. /ʁ/ - Uvular fricative
                PhoneticState(
                    name = "R_FR",
                    expectedMfcc = floatArrayOf(0.9f, 0.4f, -0.3f, -0.4f, 0.4f, -0.3f, 0.1f, -0.2f, 0.1f, -0.1f, 0.0f, 0.1f, -0.1f),
                    weight = 1.0f,
                    minFrames = 3,
                    maxFrames = 12
                ),
                // 6. /v/ - Fricative
                PhoneticState(
                    name = "V",
                    expectedMfcc = floatArrayOf(0.4f, 0.2f, -0.3f, 0.5f, -0.2f, 0.4f, -0.3f, 0.2f, -0.2f, 0.1f, -0.1f, 0.0f, 0.0f),
                    weight = 1.1f,
                    minFrames = 3,
                    maxFrames = 12
                ),
                // 7. /i/ - High front vowel
                PhoneticState(
                    name = "IY_2",
                    expectedMfcc = floatArrayOf(2.0f, 1.3f, -1.0f, 0.9f, -0.5f, 0.4f, -0.3f, 0.2f, -0.1f, 0.1f, 0.0f, 0.1f, 0.0f),
                    weight = 1.1f,
                    minFrames = 4,
                    maxFrames = 16,
                    minVoicingEnergy = 0.20f
                ),
                // 8. /s/ - Sibilant
                PhoneticState(
                    name = "S",
                    expectedMfcc = floatArrayOf(0.2f, -1.8f, 1.4f, -1.2f, 1.1f, -0.9f, 0.8f, -0.7f, 0.6f, -0.5f, 0.4f, -0.3f, 0.2f),
                    weight = 1.4f,
                    minFrames = 5,
                    maxFrames = 18,
                    minFricativeEnergy = 0.35f
                )
            )

            return WakeWordModel(
                id = "model_dis_jarvis_v2",
                phrase = "Dis JARVIS",
                language = "fr-FR",
                totalExpectedFrames = 82,
                phoneticStates = states
            )
        }

        private fun createCustomModel(phrase: String): WakeWordModel {
            val base = createHeyJarvisModel()
            return base.copy(
                id = "custom_${phrase.lowercase().replace(" ", "_")}",
                phrase = phrase
            )
        }
    }
}
