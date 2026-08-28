package com.openjarvis.android.ui.screens.settings

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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.communication.model.CommunicationActionResult
import com.openjarvis.android.ui.theme.JarvisAmber
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisRed
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import kotlinx.coroutines.launch

/**
 * Diagnostic & Management Card for JARVIS Communication Center (Step 5).
 * SMS, Notifications Listener, Contacts Access, Messaging Apps, and Direct Voice Replies.
 */
@Composable
fun CommunicationCenterCard() {
    val commController = JarvisApplication.instance.communicationController
    val scope = rememberCoroutineScope()

    var testOutput by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableStateOf(0) }

    val pendingConfirmation by commController.pendingConfirmation.collectAsState()
    val lastResult by commController.lastResult.collectAsState()
    val activeNotifs by commController.notificationController.activeNotifications.collectAsState()

    val hasNotifAccess = remember(refreshKey) { commController.permissionManager.hasNotificationListenerPermission() }
    val hasContacts = remember(refreshKey) { commController.permissionManager.hasContactsPermission() }
    val hasSmsRead = remember(refreshKey) { commController.permissionManager.hasReadSmsPermission() }
    val hasSmsSend = remember(refreshKey) { commController.permissionManager.hasSendSmsPermission() }
    val hasCall = remember(refreshKey) { commController.permissionManager.hasCallPermission() }

    val installedApps = remember(refreshKey) { commController.messagingAppController.getInstalledMessagingApps() }

    val contextSender by commController.communicationContext.lastSender.collectAsState()
    val contextApp by commController.communicationContext.lastApplication.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .border(1.dp, JarvisCyan.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "COMMUNICATION CENTER (ÉTAPE 5)",
                        color = JarvisCyanLight,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "SMS, Notifications, Contacts, WhatsApp, Telegram & Réponses Vocales",
                        color = JarvisTextSecondary,
                        fontSize = 11.sp
                    )
                }

                Button(
                    onClick = { refreshKey++ },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = JarvisCyan)
                }
            }

            // Permissions Matrix
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.6f))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Autorisations & Services Système",
                    color = JarvisTextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )

                CommunicationStatusRow(
                    label = "Service Écoute Notifications (NotificationListener)",
                    isOk = hasNotifAccess,
                    onActionClick = { commController.permissionManager.openNotificationListenerSettings() },
                    actionLabel = "Paramètres"
                )

                CommunicationStatusRow(
                    label = "Lecture du Répertoire (READ_CONTACTS)",
                    isOk = hasContacts,
                    onActionClick = { commController.permissionManager.openAppSettings() },
                    actionLabel = "Autoriser"
                )

                CommunicationStatusRow(
                    label = "Lecture des SMS (READ_SMS)",
                    isOk = hasSmsRead,
                    onActionClick = { commController.permissionManager.openAppSettings() },
                    actionLabel = "Autoriser"
                )

                CommunicationStatusRow(
                    label = "Envoi direct SMS (SEND_SMS)",
                    isOk = hasSmsSend,
                    onActionClick = { commController.permissionManager.openAppSettings() },
                    actionLabel = "Autoriser"
                )

                CommunicationStatusRow(
                    label = "Appels Directs (CALL_PHONE)",
                    isOk = hasCall,
                    onActionClick = { commController.permissionManager.openAppSettings() },
                    actionLabel = "Autoriser"
                )
            }

            // Installed Messaging Apps
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.6f))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "Applications de Messagerie Détectées (${installedApps.size})",
                    color = JarvisTextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )

                if (installedApps.isEmpty()) {
                    Text(
                        text = "Aucune application tierce compatible détectée. Le système utilisera les SMS.",
                        color = JarvisTextSecondary,
                        fontSize = 11.sp
                    )
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        installedApps.forEach { app ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(JarvisCyan.copy(alpha = 0.15f))
                                    .border(1.dp, JarvisCyan.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "✓ ${app.appName}",
                                    color = JarvisCyanLight,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // Conversational Context Status
            if (contextSender != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(JarvisCyan.copy(alpha = 0.1f))
                        .border(1.dp, JarvisCyan.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Contexte Actif : $contextSender ($contextApp)",
                                color = JarvisCyanLight,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "JARVIS se souvient de cet interlocuteur pour les réponses (« réponds-lui »)",
                                color = JarvisTextSecondary,
                                fontSize = 10.sp
                            )
                        }

                        Button(
                            onClick = {
                                commController.communicationContext.clear()
                                testOutput = "Contexte de communication réinitialisé."
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text("Effacer", fontSize = 10.sp, color = JarvisAmber)
                        }
                    }
                }
            }

            // Pending Confirmation Banner
            pendingConfirmation?.let { conf ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(JarvisAmber.copy(alpha = 0.15f))
                        .border(1.dp, JarvisAmber, RoundedCornerShape(10.dp))
                        .padding(12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "⚠️ Confirmation Vocale En Attente",
                            color = JarvisAmber,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                        Text(
                            text = conf.prompt,
                            color = JarvisTextPrimary,
                            fontSize = 12.sp
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        val res = conf.executeAction()
                                        testOutput = res.spokenMessage
                                        commController.clearPendingConfirmation()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = JarvisGreen),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Confirmer (Oui)", color = JarvisTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = {
                                    scope.launch {
                                        conf.onCancel?.invoke()
                                        commController.clearPendingConfirmation()
                                        testOutput = "Action annulée."
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = JarvisRed),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Annuler (Non)", color = JarvisTextPrimary, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // Interactive Diagnostics & Test Buttons
            Text(
                text = "Tests Vocaux & Diagnostics Immédiats",
                color = JarvisTextPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val res = commController.notificationController.readActiveNotifications()
                            testOutput = res.spokenMessage
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Notifications (${activeNotifs.size})", fontSize = 10.sp, color = JarvisCyanLight)
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val res = commController.smsController.readLastSms()
                            testOutput = res.spokenMessage
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Dernier SMS", fontSize = 10.sp, color = JarvisCyanLight)
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val res = commController.notificationController.summarizeNotifications()
                            testOutput = res.spokenMessage
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Résumé Global", fontSize = 10.sp, color = JarvisCyanLight)
                }
            }

            // Test Output
            testOutput?.let { msg ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, JarvisCyan.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Column {
                        Text(
                            text = "RÉPONSE VOCALE JARVIS :",
                            color = JarvisCyanLight,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = msg,
                            color = JarvisTextPrimary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CommunicationStatusRow(
    label: String,
    isOk: Boolean,
    onActionClick: () -> Unit,
    actionLabel: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = if (isOk) Icons.Default.CheckCircle else Icons.Default.Error,
                contentDescription = null,
                tint = if (isOk) JarvisGreen else JarvisAmber,
                modifier = Modifier.padding(2.dp)
            )
            Text(
                text = label,
                color = if (isOk) JarvisTextPrimary else JarvisTextSecondary,
                fontSize = 11.sp
            )
        }

        if (!isOk) {
            Button(
                onClick = onActionClick,
                colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan.copy(alpha = 0.8f)),
                shape = RoundedCornerShape(6.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 2.dp)
            ) {
                Text(actionLabel, fontSize = 10.sp, color = JarvisTextPrimary, fontWeight = FontWeight.Bold)
            }
        }
    }
}
