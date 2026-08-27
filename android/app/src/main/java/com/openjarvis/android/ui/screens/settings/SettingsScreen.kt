package com.openjarvis.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.config.ExecutionMode
import com.openjarvis.android.storage.SecureVault
import com.openjarvis.android.ui.theme.JarvisAmber
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisRed
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import com.openjarvis.android.voice.diagnostics.VoiceDiagnosticReport
import com.openjarvis.android.voice.diagnostics.VoiceDiagnostics

@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val configManager = JarvisApplication.instance.configManager
    val secureVault = JarvisApplication.instance.secureVault
    val config by configManager.config.collectAsState()

    var wakeWordPhrase by remember { mutableStateOf(config.wakeWordPhrase) }
    var wakeWordSensitivity by remember { mutableStateOf(config.wakeWordSensitivity) }
    var wakeWordCooldownSec by remember { mutableStateOf(config.wakeWordCooldownSec) }
    var lanUrl by remember { mutableStateOf(config.lanServerUrl) }
    var geminiKey by remember { mutableStateOf(secureVault.getSecret(SecureVault.KEY_GEMINI)) }
    var openaiKey by remember { mutableStateOf(secureVault.getSecret(SecureVault.KEY_OPENAI)) }
    var deepgramKey by remember { mutableStateOf(secureVault.getSecret(SecureVault.KEY_DEEPGRAM)) }
    var savedSuccess by remember { mutableStateOf(false) }

    var diagnosticReport by remember { mutableStateOf<VoiceDiagnosticReport?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "ASSISTANT VOCAL & WAKE-WORD",
                color = JarvisCyanLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        // Wake-word toggle & phrase configuration
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .border(1.dp, JarvisCyan.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Détection « Hey JARVIS »",
                                color = JarvisTextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Écoute continue en arrière-plan (Basse consommation)",
                                color = JarvisTextSecondary,
                                fontSize = 12.sp
                            )
                        }
                        Switch(
                            checked = config.wakeWordEnabled,
                            onCheckedChange = {
                                configManager.updateConfig(config.copy(wakeWordEnabled = it))
                                if (it) {
                                    JarvisApplication.instance.voiceEngine.startBackgroundListening()
                                } else {
                                    JarvisApplication.instance.voiceEngine.stopBackgroundListening()
                                }
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = JarvisTextPrimary,
                                checkedTrackColor = JarvisCyan
                            )
                        )
                    }

                    OutlinedTextField(
                        value = wakeWordPhrase,
                        onValueChange = {
                            wakeWordPhrase = it
                            JarvisApplication.instance.voiceEngine.wakeWordEngine.setWakeWord(it)
                        },
                        label = { Text("Phrase d'activation (Wake Word)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = JarvisCyanLight,
                            unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                        )
                    )

                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Sensibilité de détection (Seuil ${String.format("%.2f", 0.90f - wakeWordSensitivity * 0.30f)})", color = JarvisTextSecondary, fontSize = 12.sp)
                            Text("${(wakeWordSensitivity * 100).toInt()} %", color = JarvisCyanLight, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Slider(
                            value = wakeWordSensitivity,
                            onValueChange = {
                                wakeWordSensitivity = it
                                JarvisApplication.instance.voiceEngine.wakeWordEngine.setSensitivity(it)
                            },
                            valueRange = 0.1f..1.0f,
                            colors = SliderDefaults.colors(
                                thumbColor = JarvisCyan,
                                activeTrackColor = JarvisCyan
                            )
                        )
                    }

                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Cooldown anti-rebond (Délai après détection)", color = JarvisTextSecondary, fontSize = 12.sp)
                            Text("${String.format("%.1f", wakeWordCooldownSec)} s", color = JarvisCyanLight, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Slider(
                            value = wakeWordCooldownSec,
                            onValueChange = {
                                wakeWordCooldownSec = it
                                JarvisApplication.instance.voiceEngine.wakeWordEngine.setCooldownMs((it * 1000).toLong())
                            },
                            valueRange = 0.5f..4.0f,
                            colors = SliderDefaults.colors(
                                thumbColor = JarvisCyan,
                                activeTrackColor = JarvisCyan
                            )
                        )
                    }
                }
            }
        }

        // Voice Subsystems Diagnostics Card
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .border(1.dp, JarvisCyan.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Diagnostic du Système Vocal",
                            color = JarvisTextPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Button(
                            onClick = {
                                diagnosticReport = VoiceDiagnostics.runVoiceDiagnostics(context)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.2f)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Tester", tint = JarvisCyan, modifier = Modifier.padding(end = 4.dp))
                            Text("Tester", color = JarvisCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (diagnosticReport != null) {
                        val report = diagnosticReport!!
                        Text(
                            text = report.summary,
                            color = if (report.overallStatus) JarvisGreen else JarvisAmber,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        report.items.forEach { item ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = if (item.isOk) Icons.Default.CheckCircle else Icons.Default.Error,
                                    contentDescription = null,
                                    tint = if (item.isOk) JarvisGreen else JarvisAmber,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                                Column {
                                    Text(item.title, color = JarvisTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                    Text(item.details, color = JarvisTextSecondary, fontSize = 11.sp)
                                    if (item.recommendation != null) {
                                        Text("-> ${item.recommendation}", color = JarvisAmber, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    } else {
                        Text(
                            text = "Cliquez sur « Tester » pour vérifier le micro, la synthèse vocale, l'exclusion de batterie et les autorisations.",
                            color = JarvisTextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        // Mode & Cloud Engine Selection
        item {
            Text(
                text = "CONFIGURATION DU MOTEUR D'INFÉRENCE",
                color = JarvisCyanLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        // Execution Mode Selection
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .border(1.dp, JarvisCyan.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                    .padding(16.dp)
            ) {
                Column {
                    Text(
                        text = "Mode d'Inférence Actif",
                        color = JarvisTextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            ExecutionMode.HYBRID to "Hybride",
                            ExecutionMode.LOCAL_ONLY to "Local",
                            ExecutionMode.CLOUD_ONLY to "Cloud",
                            ExecutionMode.LAN_ONLY to "LAN"
                        ).forEach { (mode, label) ->
                            val isSelected = config.executionMode == mode
                            Button(
                                onClick = { configManager.updateConfig(config.copy(executionMode = mode)) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isSelected) JarvisCyan else MaterialTheme.colorScheme.surface
                                ),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = label,
                                    fontSize = 11.sp,
                                    color = if (isSelected) JarvisTextPrimary else JarvisTextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        // API Keys (Keystore Encrypted)
        item {
            Text(
                text = "CLÉS D'API & SÉCURITÉ (ANDROID KEYSTORE)",
                color = JarvisCyanLight,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        item {
            OutlinedTextField(
                value = geminiKey,
                onValueChange = { geminiKey = it },
                label = { Text("Google Gemini API Key") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = JarvisCyanLight,
                    unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                )
            )
        }

        item {
            OutlinedTextField(
                value = deepgramKey,
                onValueChange = { deepgramKey = it },
                label = { Text("Deepgram API Key (STT & TTS HD)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = JarvisCyanLight,
                    unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                )
            )
        }

        item {
            OutlinedTextField(
                value = openaiKey,
                onValueChange = { openaiKey = it },
                label = { Text("OpenAI API Key") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = JarvisCyanLight,
                    unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                )
            )
        }

        item {
            OutlinedTextField(
                value = lanUrl,
                onValueChange = { lanUrl = it },
                label = { Text("URL Serveur LAN (Ollama / vLLM)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = JarvisCyanLight,
                    unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                )
            )
        }

        item {
            Button(
                onClick = {
                    secureVault.putSecret(SecureVault.KEY_GEMINI, geminiKey)
                    secureVault.putSecret(SecureVault.KEY_OPENAI, openaiKey)
                    secureVault.putSecret(SecureVault.KEY_DEEPGRAM, deepgramKey)
                    configManager.updateConfig(
                        config.copy(
                            lanServerUrl = lanUrl,
                            wakeWordPhrase = wakeWordPhrase,
                            wakeWordSensitivity = wakeWordSensitivity,
                            wakeWordThreshold = 0.90f - wakeWordSensitivity * 0.30f,
                            wakeWordCooldownSec = wakeWordCooldownSec
                        )
                    )
                    savedSuccess = true
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Enregistrer les Paramètres Sécurisés", color = JarvisTextPrimary, fontWeight = FontWeight.Bold)
            }
        }

        if (savedSuccess) {
            item {
                Text(
                    text = "✓ Paramètres enregistrés avec succès dans le Keystore matériel.",
                    color = JarvisGreen,
                    fontSize = 12.sp
                )
            }
        }
    }
}
