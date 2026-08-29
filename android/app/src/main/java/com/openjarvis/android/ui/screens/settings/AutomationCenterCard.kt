package com.openjarvis.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.automation.model.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AutomationCenterCard(
    modifier: Modifier = Modifier
) {
    val app = JarvisApplication.instance
    val automationManager = app.automationManager
    val scope = rememberCoroutineScope()

    val automations by automationManager.observeAllAutomations().collectAsState(initial = emptyList())
    val executionHistory by automationManager.observeRecentExecutions(30).collectAsState(initial = emptyList())
    val pendingConfirmation by automationManager.pendingConfirmation.collectAsState()

    var showCreateDialog by remember { mutableStateOf(false) }
    var showHistoryDialog by remember { mutableStateOf(false) }
    var selectedFilter by remember { mutableStateOf("TOUS") }
    var testResultBanner by remember { mutableStateOf<String?>(null) }

    // Cyberpunk/HUD Theme Colors
    val cardBg = Color(0xFF0D1520)
    val cardBorder = Color(0xFF1E3A5F)
    val cyanAccent = Color(0xFF00E5FF)
    val textPrimary = Color(0xFFE2F1FF)
    val textSecondary = Color(0xFF8FA7C4)
    val successColor = Color(0xFF00E676)
    val warningColor = Color(0xFFFFB300)
    val errorColor = Color(0xFFFF5252)

    val filteredAutomations = remember(automations, selectedFilter) {
        when (selectedFilter) {
            "TIME" -> automations.filter { it.trigger.type == TriggerType.TIME_TRIGGER || it.trigger.type == TriggerType.DATE_TRIGGER }
            "EVENTS" -> automations.filter { it.trigger.type == TriggerType.BATTERY_TRIGGER || it.trigger.type == TriggerType.CHARGING_TRIGGER || it.trigger.type == TriggerType.NOTIFICATION_TRIGGER }
            "SYSTEM" -> automations.filter { it.isSystem }
            else -> automations
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(cardBg)
            .border(1.dp, cardBorder, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(cyanAccent.copy(alpha = 0.15f))
                        .border(1.dp, cyanAccent.copy(alpha = 0.4f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = "Automation",
                        tint = cyanAccent,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "CENTRE D'AUTOMATISATION",
                        color = textPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "${automations.count { it.enabled }} actives / ${automations.size} routines",
                        color = textSecondary,
                        fontSize = 11.sp
                    )
                }
            }

            Row {
                IconButton(
                    onClick = { showHistoryDialog = true },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = "Historique",
                        tint = cyanAccent,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                IconButton(
                    onClick = { showCreateDialog = true },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Créer",
                        tint = cyanAccent,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Test Result Banner if active
        testResultBanner?.let { msg ->
            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(cyanAccent.copy(alpha = 0.1f))
                    .border(1.dp, cyanAccent.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                    .padding(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = msg, color = textPrimary, fontSize = 11.sp)
                    IconButton(
                        onClick = { testResultBanner = null },
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Fermer", tint = textSecondary, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }

        // Pending Sensitive Confirmation Banner
        pendingConfirmation?.let { conf ->
            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(warningColor.copy(alpha = 0.15f))
                    .border(1.dp, warningColor.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    .padding(10.dp)
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.Warning, contentDescription = null, tint = warningColor, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(text = "Autorisation Requise", color = warningColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = conf.prompt, color = textPrimary, fontSize = 11.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                        TextButton(
                            onClick = { automationManager.engine.dismissPendingConfirmation() },
                            colors = ButtonDefaults.textButtonColors(contentColor = textSecondary)
                        ) {
                            Text("Refuser", fontSize = 11.sp)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                scope.launch { conf.onConfirm.invoke() }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = warningColor, contentColor = Color.Black),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            Text("Autoriser", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Filter Chips Row
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            val filters = listOf(
                "TOUS" to "Toutes",
                "TIME" to "Planifiées",
                "EVENTS" to "Événements",
                "SYSTEM" to "Système"
            )
            items(filters) { (key, label) ->
                val isSelected = selectedFilter == key
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) cyanAccent.copy(alpha = 0.2f) else Color(0xFF142233))
                        .border(1.dp, if (isSelected) cyanAccent else Color(0xFF223A54), RoundedCornerShape(20.dp))
                        .clickable { selectedFilter = key }
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = label,
                        color = if (isSelected) cyanAccent else textSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Automations List
        if (filteredAutomations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Aucune automatisation dans cette catégorie.",
                    color = textSecondary,
                    fontSize = 12.sp
                )
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                filteredAutomations.forEach { auto ->
                    AutomationItemRow(
                        automation = auto,
                        onToggle = { enable ->
                            scope.launch { automationManager.toggleAutomation(auto.id, enable) }
                        },
                        onTest = {
                            scope.launch {
                                val res = automationManager.testAutomation(auto.id)
                                testResultBanner = "Test [${auto.name}] : ${res?.status?.frenchLabel ?: "Terminé"}"
                            }
                        },
                        onDelete = {
                            scope.launch { automationManager.deleteAutomation(auto.id) }
                        }
                    )
                }
            }
        }
    }

    // Create Automation Dialog
    if (showCreateDialog) {
        CreateAutomationDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { newAuto ->
                scope.launch {
                    val (success, err) = automationManager.createOrUpdateAutomation(newAuto)
                    if (success) {
                        showCreateDialog = false
                    } else {
                        testResultBanner = "Erreur : $err"
                    }
                }
            }
        )
    }

    // Diagnostics & History Dialog
    if (showHistoryDialog) {
        AutomationHistoryDialog(
            history = executionHistory,
            onDismiss = { showHistoryDialog = false },
            onClear = {
                scope.launch { automationManager.clearExecutionHistory() }
            }
        )
    }
}

@Composable
fun AutomationItemRow(
    automation: Automation,
    onToggle: (Boolean) -> Unit,
    onTest: () -> Unit,
    onDelete: () -> Unit
) {
    val cyanAccent = Color(0xFF00E5FF)
    val textPrimary = Color(0xFFE2F1FF)
    val textSecondary = Color(0xFF8FA7C4)
    val itemBg = Color(0xFF131F2E)
    val itemBorder = Color(0xFF1E334D)

    val triggerIcon = when (automation.trigger.type) {
        TriggerType.TIME_TRIGGER, TriggerType.DATE_TRIGGER -> Icons.Default.AccessTime
        TriggerType.BATTERY_TRIGGER -> Icons.Default.BatteryChargingFull
        TriggerType.CHARGING_TRIGGER -> Icons.Default.Power
        TriggerType.NOTIFICATION_TRIGGER -> Icons.Default.Notifications
        TriggerType.VOICE_TRIGGER -> Icons.Default.Mic
        else -> Icons.Default.Bolt
    }

    val sdf = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(itemBg)
            .border(1.dp, itemBorder, RoundedCornerShape(10.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = triggerIcon,
                contentDescription = null,
                tint = if (automation.enabled) cyanAccent else textSecondary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = automation.name,
                    color = textPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = automation.description.ifBlank {
                        "Déclencheur : ${automation.trigger.type.frenchLabel}"
                    },
                    color = textSecondary,
                    fontSize = 10.sp,
                    maxLines = 1
                )
                if (automation.lastRun != null) {
                    Text(
                        text = "Dernière exécution : ${sdf.format(Date(automation.lastRun))} (${automation.runCount} fois)",
                        color = cyanAccent.copy(alpha = 0.7f),
                        fontSize = 9.sp
                    )
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = onTest,
                modifier = Modifier.size(28.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Tester",
                    tint = cyanAccent,
                    modifier = Modifier.size(16.dp)
                )
            }

            Switch(
                checked = automation.enabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = cyanAccent,
                    checkedTrackColor = cyanAccent.copy(alpha = 0.3f),
                    uncheckedThumbColor = textSecondary,
                    uncheckedTrackColor = Color(0xFF0F1A26)
                ),
                modifier = Modifier.size(width = 38.dp, height = 24.dp)
            )

            if (!automation.isSystem) {
                Spacer(modifier = Modifier.width(4.dp))
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Supprimer",
                        tint = Color(0xFFFF5252).copy(alpha = 0.7f),
                        modifier = Modifier.size(15.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun CreateAutomationDialog(
    onDismiss: () -> Unit,
    onCreate: (Automation) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var triggerType by remember { mutableStateOf(TriggerType.TIME_TRIGGER) }
    var timeOfDay by remember { mutableStateOf("08:00") }
    var batteryThreshold by remember { mutableStateOf("20") }
    var actionType by remember { mutableStateOf(ActionType.SPEAK) }
    var spokenMessage by remember { mutableStateOf("") }
    var notificationTitle by remember { mutableStateOf("JARVIS") }

    val cyanAccent = Color(0xFF00E5FF)
    val textPrimary = Color(0xFFE2F1FF)
    val cardBg = Color(0xFF0E1724)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = cardBg,
        title = {
            Text("Créer une Automatisation", color = textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nom de la routine", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Déclencheur :", color = cyanAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        TriggerType.TIME_TRIGGER to "Heure",
                        TriggerType.BATTERY_TRIGGER to "Batterie",
                        TriggerType.CHARGING_TRIGGER to "Charge"
                    ).forEach { (type, label) ->
                        val selected = triggerType == type
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (selected) cyanAccent.copy(alpha = 0.2f) else Color(0xFF182638))
                                .border(1.dp, if (selected) cyanAccent else Color.Transparent, RoundedCornerShape(6.dp))
                                .clickable { triggerType = type }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(label, color = if (selected) cyanAccent else Color.Gray, fontSize = 10.sp)
                        }
                    }
                }

                if (triggerType == TriggerType.TIME_TRIGGER) {
                    OutlinedTextField(
                        value = timeOfDay,
                        onValueChange = { timeOfDay = it },
                        label = { Text("Heure (HH:mm)", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else if (triggerType == TriggerType.BATTERY_TRIGGER) {
                    OutlinedTextField(
                        value = batteryThreshold,
                        onValueChange = { batteryThreshold = it },
                        label = { Text("Seuil Batterie (%)", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Text("Action :", color = cyanAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        ActionType.SPEAK to "Parler (TTS)",
                        ActionType.START_BRIEFING to "Briefing",
                        ActionType.SHOW_NOTIFICATION to "Notification"
                    ).forEach { (type, label) ->
                        val selected = actionType == type
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (selected) cyanAccent.copy(alpha = 0.2f) else Color(0xFF182638))
                                .border(1.dp, if (selected) cyanAccent else Color.Transparent, RoundedCornerShape(6.dp))
                                .clickable { actionType = type }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(label, color = if (selected) cyanAccent else Color.Gray, fontSize = 10.sp)
                        }
                    }
                }

                if (actionType == ActionType.SPEAK) {
                    OutlinedTextField(
                        value = spokenMessage,
                        onValueChange = { spokenMessage = it },
                        label = { Text("Message vocal à synthétiser", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth()
                    )
                } else if (actionType == ActionType.SHOW_NOTIFICATION) {
                    OutlinedTextField(
                        value = notificationTitle,
                        onValueChange = { notificationTitle = it },
                        label = { Text("Titre de la notification", fontSize = 11.sp) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = spokenMessage,
                        onValueChange = { spokenMessage = it },
                        label = { Text("Corps de la notification", fontSize = 11.sp) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val trigger = when (triggerType) {
                        TriggerType.TIME_TRIGGER -> AutomationTrigger(
                            type = TriggerType.TIME_TRIGGER,
                            timeOfDay = timeOfDay,
                            repeatPattern = RepeatPattern.DAILY
                        )
                        TriggerType.BATTERY_TRIGGER -> AutomationTrigger(
                            type = TriggerType.BATTERY_TRIGGER,
                            batteryThreshold = batteryThreshold.toIntOrNull() ?: 20,
                            batteryTriggerBelow = true
                        )
                        TriggerType.CHARGING_TRIGGER -> AutomationTrigger(
                            type = TriggerType.CHARGING_TRIGGER,
                            isCharging = true
                        )
                        else -> AutomationTrigger(type = TriggerType.MANUAL_TRIGGER)
                    }

                    val action = AutomationAction(
                        type = actionType,
                        message = spokenMessage.ifBlank { null },
                        notificationTitle = notificationTitle.ifBlank { "JARVIS" },
                        notificationBody = spokenMessage.ifBlank { "Notification JARVIS" }
                    )

                    val auto = Automation(
                        name = name.ifBlank { "Routine Personnalisée" },
                        description = "Déclenché par ${triggerType.frenchLabel}",
                        enabled = true,
                        trigger = trigger,
                        actions = listOf(action)
                    )
                    onCreate(auto)
                },
                colors = ButtonDefaults.buttonColors(containerColor = cyanAccent, contentColor = Color.Black)
            ) {
                Text("Enregistrer", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = Color.Gray)
            }
        }
    )
}

@Composable
fun AutomationHistoryDialog(
    history: List<ExecutionResult>,
    onDismiss: () -> Unit,
    onClear: () -> Unit
) {
    val cyanAccent = Color(0xFF00E5FF)
    val textPrimary = Color(0xFFE2F1FF)
    val textSecondary = Color(0xFF8FA7C4)
    val cardBg = Color(0xFF0E1724)
    val sdf = remember { SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = cardBg,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Journal d'Exécution", color = textPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                if (history.isNotEmpty()) {
                    TextButton(onClick = onClear) {
                        Text("Effacer", color = Color(0xFFFF5252), fontSize = 11.sp)
                    }
                }
            }
        },
        text = {
            if (history.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Aucune exécution enregistrée.", color = textSecondary, fontSize = 12.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(history) { item ->
                        val statusColor = when (item.status) {
                            ExecutionStatus.SUCCESS -> Color(0xFF00E676)
                            ExecutionStatus.SKIPPED -> Color(0xFFFFB300)
                            ExecutionStatus.PENDING_CONFIRMATION -> Color(0xFF00E5FF)
                            else -> Color(0xFFFF5252)
                        }

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFF142130))
                                .padding(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = item.automationName,
                                    color = textPrimary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = item.status.frenchLabel,
                                    color = statusColor,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Déclencheur : ${item.trigger.frenchLabel}",
                                    color = textSecondary,
                                    fontSize = 9.sp
                                )
                                Text(
                                    text = "${sdf.format(Date(item.timestamp))} (${item.durationMs}ms)",
                                    color = textSecondary,
                                    fontSize = 9.sp
                                )
                            }
                            if (!item.spokenMessage.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "« ${item.spokenMessage} »",
                                    color = cyanAccent.copy(alpha = 0.8f),
                                    fontSize = 9.sp
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = cyanAccent, contentColor = Color.Black)
            ) {
                Text("Fermer", fontWeight = FontWeight.Bold)
            }
        }
    )
}
