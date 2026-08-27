package com.openjarvis.android.ui.screens.voice

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.ui.theme.JarvisAmber
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisRed
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.voice.VoiceState

@Composable
fun VoiceHudScreen() {
    val voiceEngine = JarvisApplication.instance.voiceEngine
    val voiceState by voiceEngine.voiceState.collectAsState()
    val transcript by voiceEngine.currentTranscript.collectAsState()
    val audioLevel by voiceEngine.audioLevel.collectAsState()
    val coreBridge = JarvisApplication.instance.coreBridge
    val lastResponse by coreBridge.lastResponse.collectAsState()
    val config by JarvisApplication.instance.configManager.config.collectAsState()

    // Pulsing animations for active voice states
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = if (voiceState.isBusy || voiceState == VoiceState.LISTENING_COMMAND) 1.25f else 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    val stateColor = when (voiceState) {
        VoiceState.IDLE -> JarvisCyan
        VoiceState.LISTENING_FOR_WAKE_WORD -> JarvisCyan
        VoiceState.WAKE_WORD_DETECTED -> JarvisGreen
        VoiceState.LISTENING_COMMAND -> JarvisGreen
        VoiceState.PROCESSING -> JarvisAmber
        VoiceState.SPEAKING -> JarvisCyanLight
        VoiceState.PAUSED -> JarvisAmber
        VoiceState.ERROR -> JarvisRed
        VoiceState.STOPPED -> Color.Gray
    }

    val stateLabel = when (voiceState) {
        VoiceState.IDLE -> "EN VEILLE"
        VoiceState.LISTENING_FOR_WAKE_WORD -> "ÉCOUTE DE « ${config.wakeWordPhrase} »"
        VoiceState.WAKE_WORD_DETECTED -> "MOT-CLÉ DÉTECTÉ !"
        VoiceState.LISTENING_COMMAND -> "ÉCOUTE DE LA COMMANDE..."
        VoiceState.PROCESSING -> "RAISONNEMENT JARVIS..."
        VoiceState.SPEAKING -> "RÉPONSE VOCALE..."
        VoiceState.PAUSED -> "EN PAUSE"
        VoiceState.ERROR -> "ERREUR SOUS-SYSTÈME AUDIO"
        VoiceState.STOPPED -> "SERVICE ARRÊTÉ"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top HUD Header
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "JARVIS VOICE CORE 6.0",
                color = JarvisCyanLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(stateColor.copy(alpha = 0.15f))
                    .border(1.dp, stateColor.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            ) {
                Text(
                    text = stateLabel,
                    color = stateColor,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Center Animated Voice Arc Reactor
        Box(
            modifier = Modifier.size(240.dp),
            contentAlignment = Alignment.Center
        ) {
            // Outer Glowing Ring
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .scale(pulseScale)
                    .clip(CircleShape)
                    .background(stateColor.copy(alpha = 0.08f))
                    .border(2.dp, stateColor.copy(alpha = 0.3f), CircleShape)
            )

            // Dynamic Audio Level Ring
            val dynamicScale = (1.0f + (audioLevel / 100f).coerceIn(0f, 0.4f))
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .scale(dynamicScale)
                    .clip(CircleShape)
                    .background(stateColor.copy(alpha = 0.12f))
                    .border(1.dp, stateColor.copy(alpha = 0.4f), CircleShape)
            )

            // Inner Orb Reactor / Touch to Speak
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(stateColor.copy(alpha = 0.25f))
                    .border(2.dp, stateColor, CircleShape)
                    .clickable {
                        when (voiceState) {
                            VoiceState.IDLE, VoiceState.LISTENING_FOR_WAKE_WORD, VoiceState.STOPPED -> {
                                voiceEngine.startListeningForCommand()
                            }
                            VoiceState.LISTENING_COMMAND -> {
                                voiceEngine.speechProvider.stopListening()
                            }
                            VoiceState.PROCESSING, VoiceState.SPEAKING -> {
                                voiceEngine.cancelCurrentInteraction("Interruption manuelle utilisateur")
                            }
                            else -> {
                                voiceEngine.returnToWakeWordListening()
                            }
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (voiceState) {
                        VoiceState.SPEAKING -> Icons.Default.VolumeUp
                        VoiceState.PROCESSING -> Icons.Default.Stop
                        VoiceState.STOPPED -> Icons.Default.MicOff
                        else -> Icons.Default.Mic
                    },
                    contentDescription = "Voice Reactor",
                    tint = JarvisTextPrimary,
                    modifier = Modifier.size(44.dp)
                )
            }
        }

        // Live Transcript / Response Section
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (transcript.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(JarvisGreen.copy(alpha = 0.1f))
                        .border(1.dp, JarvisGreen.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                        .padding(12.dp)
                ) {
                    Text(
                        text = "« $transcript »",
                        color = JarvisGreen,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
            } else if (lastResponse.isNotEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .border(1.dp, JarvisCyan.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Text(
                        text = lastResponse,
                        color = JarvisTextPrimary,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Quick Interruption & Control Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Dites « ${config.wakeWordPhrase} » ou « Arrête » à tout moment",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
