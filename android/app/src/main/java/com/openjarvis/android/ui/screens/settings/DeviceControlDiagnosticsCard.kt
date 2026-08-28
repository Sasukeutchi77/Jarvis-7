package com.openjarvis.android.ui.screens.settings

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.device.history.JarvisActionHistory
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.CapabilityState
import com.openjarvis.android.device.model.DeviceCapabilityInfo
import com.openjarvis.android.ui.theme.JarvisAmber
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisRed
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import kotlinx.coroutines.launch

@Composable
fun DeviceControlDiagnosticsCard() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val deviceController = JarvisApplication.instance.deviceController
    val permissionManager = deviceController.permissionManager

    var capabilities by remember { mutableStateOf(permissionManager.auditCapabilities()) }
    var testFeedback by remember { mutableStateOf<String?>(null) }
    var showHistory by remember { mutableStateOf(false) }

    val lastResult by deviceController.lastActionResult.collectAsState()
    val pendingConf by deviceController.pendingConfirmation.collectAsState()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                            text = "DIAGNOSTIC DU CONTRÔLE APPAREIL",
                            color = JarvisCyan,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Vérification des APIs Android officielles & permissions",
                            color = JarvisTextSecondary,
                            fontSize = 11.sp
                        )
                    }

                    Button(
                        onClick = {
                            capabilities = permissionManager.auditCapabilities()
                            testFeedback = "Capacités matérielles et autorisations rafraîchies."
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.2f)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraîchir", tint = JarvisCyan, modifier = Modifier.padding(end = 4.dp))
                        Text("Auditer", color = JarvisCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Capabilities List
                capabilities.forEach { cap ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            val iconColor = when (cap.state) {
                                CapabilityState.AVAILABLE -> JarvisGreen
                                CapabilityState.PERMISSION_MISSING -> JarvisAmber
                                CapabilityState.SYSTEM_RESTRICTED -> JarvisAmber
                                CapabilityState.HARDWARE_UNAVAILABLE -> JarvisRed
                            }
                            Icon(
                                imageVector = if (cap.state == CapabilityState.AVAILABLE) Icons.Default.CheckCircle else Icons.Default.Error,
                                contentDescription = null,
                                tint = iconColor,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                            Column {
                                Text(cap.name, color = JarvisTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Text(cap.description, color = JarvisTextSecondary, fontSize = 10.sp)
                            }
                        }

                        if (cap.settingsAction != null && cap.state != CapabilityState.AVAILABLE) {
                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(cap.settingsAction).apply {
                                            if (cap.settingsAction == Settings.ACTION_MANAGE_OVERLAY_PERMISSION ||
                                                cap.settingsAction == Settings.ACTION_MANAGE_WRITE_SETTINGS) {
                                                data = Uri.parse("package:${context.packageName}")
                                            }
                                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                        }
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        testFeedback = "Impossible d'ouvrir les paramètres : ${e.message}"
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = JarvisAmber.copy(alpha = 0.2f)),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Activer", color = JarvisAmber, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Interactive Test Triggers
                Text("Tests Rapides des Contrôleurs Matériels :", color = JarvisCyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            scope.launch {
                                val res = deviceController.processCommand("allume la lampe")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Torche ON", color = JarvisTextPrimary, fontSize = 10.sp)
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                val res = deviceController.processCommand("éteins la lampe")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Torche OFF", color = JarvisTextPrimary, fontSize = 10.sp)
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                val res = deviceController.processCommand("combien de batterie me reste-t-il ?")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Batterie", color = JarvisTextPrimary, fontSize = 10.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            scope.launch {
                                val res = deviceController.processCommand("mets le volume à 60 %")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Volume 60%", color = JarvisTextPrimary, fontSize = 10.sp)
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                val res = deviceController.processCommand("ouvre l'appareil photo")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.15f)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Caméra", color = JarvisTextPrimary, fontSize = 10.sp)
                    }

                    Button(
                        onClick = {
                            showHistory = !showHistory
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = if (showHistory) JarvisCyan else MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Historique", color = JarvisTextPrimary, fontSize = 10.sp)
                    }
                }

                if (testFeedback != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(10.dp)
                    ) {
                        Text("Résultat : $testFeedback", color = JarvisCyan, fontSize = 11.sp)
                    }
                }

                // Pending Sensitive Confirmation Banner
                if (pendingConf != null) {
                    val conf = pendingConf!!
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(JarvisAmber.copy(alpha = 0.15f))
                            .border(1.dp, JarvisAmber, RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Confirmation Requise (${conf.actionType}) :", color = JarvisAmber, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(conf.prompt, color = JarvisTextPrimary, fontSize = 11.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        scope.launch {
                                            deviceController.processCommand("oui")
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = JarvisGreen),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text("Confirmer", color = JarvisTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                                Button(
                                    onClick = {
                                        scope.launch {
                                            deviceController.processCommand("non")
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = JarvisRed),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text("Annuler", color = JarvisTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Action History List
                if (showHistory) {
                    val records = JarvisActionHistory.getAll()
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Journal d'Audit des Actions Système :", color = JarvisCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        if (records.isEmpty()) {
                            Text("Aucune commande système enregistrée pour l'instant.", color = JarvisTextSecondary, fontSize = 11.sp)
                        } else {
                            records.take(6).forEach { rec ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(MaterialTheme.colorScheme.surface)
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(rec.command, color = JarvisTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                                        Text("${rec.actionType} • ${rec.message}", color = JarvisTextSecondary, fontSize = 10.sp)
                                    }
                                    val statusColor = when (rec.status) {
                                        ActionResultStatus.SUCCESS -> JarvisGreen
                                        ActionResultStatus.REQUIRES_CONFIRMATION -> JarvisAmber
                                        else -> JarvisRed
                                    }
                                    Text(rec.status.name, color = statusColor, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
