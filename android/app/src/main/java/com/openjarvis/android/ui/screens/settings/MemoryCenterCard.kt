package com.openjarvis.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.memory.model.MemoryCategory
import com.openjarvis.android.storage.database.entity.MemoryEntity
import com.openjarvis.android.ui.theme.JarvisAmber
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisRed
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Interactive Diagnostic & Control Panel for JARVIS Memory Core (Step 6).
 * Manages Short-Term, Conversation, and Long-Term Room Database with FTS5 search.
 */
@Composable
fun MemoryCenterCard() {
    val memoryCore = JarvisApplication.instance.memoryCore
    val scope = rememberCoroutineScope()

    val config by memoryCore.settings.config.collectAsState()
    val allMemories by memoryCore.observeAllMemories().collectAsState(initial = emptyList())
    val memoryCount by memoryCore.observeMemoryCount().collectAsState(initial = 0)
    val pendingConfirmation by memoryCore.pendingConfirmation.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedCategoryFilter by remember { mutableStateOf<MemoryCategory?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var testFeedback by remember { mutableStateOf<String?>(null) }

    val filteredMemories = remember(allMemories, searchQuery, selectedCategoryFilter) {
        allMemories.filter { mem ->
            val matchesQuery = searchQuery.isBlank() || mem.content.contains(searchQuery, ignoreCase = true)
            val matchesCat = selectedCategoryFilter == null || mem.category.equals(selectedCategoryFilter?.name, ignoreCase = true)
            matchesQuery && matchesCat
        }
    }

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
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        imageVector = Icons.Default.Psychology,
                        contentDescription = "Memory Core",
                        tint = JarvisCyan,
                        modifier = Modifier.size(20.dp)
                    )
                    Column {
                        Text(
                            text = "MEMORY CORE (ÉTAPE 6)",
                            color = JarvisCyanLight,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "Mémoire 3 Tiers • FTS5 Local • Anti-Fuite Clés",
                            color = JarvisTextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }

                // Count Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (config.memoryEnabled) JarvisCyan.copy(alpha = 0.15f) else JarvisRed.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (config.memoryEnabled) "$memoryCount souvenirs" else "Désactivé",
                        color = if (config.memoryEnabled) JarvisCyanLight else JarvisRed,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Pending Confirmation Bar (e.g. for clearing all memories)
            pendingConfirmation?.let { confirm ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(JarvisAmber.copy(alpha = 0.15f))
                        .border(1.dp, JarvisAmber.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = JarvisAmber, modifier = Modifier.size(16.dp))
                            Text(
                                text = "CONFIRMATION REQUISE",
                                color = JarvisAmber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = confirm.prompt,
                            color = JarvisTextPrimary,
                            fontSize = 12.sp
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        val res = memoryCore.handleConfirmation(true)
                                        testFeedback = res.spokenMessage
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = JarvisRed),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Confirmer l'effacement", fontSize = 11.sp)
                            }
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        val res = memoryCore.handleConfirmation(false)
                                        testFeedback = res.spokenMessage
                                    }
                                },
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Annuler", color = JarvisTextSecondary, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // Switches Configuration Box
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.Black.copy(alpha = 0.25f))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Memory Master Switch
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Système de Mémoire JARVIS", color = JarvisTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text("Stockage local persistant & injection contextuelle", color = JarvisTextSecondary, fontSize = 11.sp)
                    }
                    Switch(
                        checked = config.memoryEnabled,
                        onCheckedChange = { memoryCore.settings.setMemoryEnabled(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = JarvisCyan,
                            checkedTrackColor = JarvisCyan.copy(alpha = 0.3f)
                        )
                    )
                }

                // Private Mode Switch
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Mode Privé", color = JarvisTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            if (config.privateMemoryMode) {
                                Icon(Icons.Default.Lock, contentDescription = null, tint = JarvisAmber, modifier = Modifier.size(14.dp))
                            }
                        }
                        Text("Aucun nouveau souvenir enregistré en mode privé", color = JarvisTextSecondary, fontSize = 11.sp)
                    }
                    Switch(
                        checked = config.privateMemoryMode,
                        onCheckedChange = { memoryCore.settings.setPrivateMemoryMode(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = JarvisAmber,
                            checkedTrackColor = JarvisAmber.copy(alpha = 0.3f)
                        )
                    )
                }
            }

            // Search Bar & Filter Chips
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Rechercher dans les souvenirs...", fontSize = 12.sp, color = JarvisTextSecondary) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = JarvisCyan, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = JarvisTextSecondary, modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = JarvisCyan,
                        unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f),
                        focusedTextColor = JarvisTextPrimary,
                        unfocusedTextColor = JarvisTextPrimary
                    )
                )

                // Category Filter Chips
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    item {
                        CategoryFilterChip(
                            label = "TOUTES",
                            isSelected = selectedCategoryFilter == null,
                            onClick = { selectedCategoryFilter = null }
                        )
                    }
                    items(MemoryCategory.entries) { cat ->
                        CategoryFilterChip(
                            label = cat.frenchLabel,
                            isSelected = selectedCategoryFilter == cat,
                            onClick = { selectedCategoryFilter = if (selectedCategoryFilter == cat) null else cat }
                        )
                    }
                }
            }

            // Memories List (Top 6 filtered)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (filteredMemories.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (searchQuery.isBlank()) "Aucun souvenir enregistré." else "Aucun résultat pour « $searchQuery »",
                            color = JarvisTextSecondary,
                            fontSize = 12.sp
                        )
                    }
                } else {
                    filteredMemories.take(6).forEach { mem ->
                        MemoryItemRow(
                            memory = mem,
                            onDelete = {
                                scope.launch {
                                    memoryCore.longTermMemory.forgetMemory(mem.id)
                                    testFeedback = "Souvenir supprimé."
                                }
                            }
                        )
                    }
                }
            }

            // Test & Action Buttons
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { showAddDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Ajouter", fontSize = 12.sp, color = Color.Black, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val result = memoryCore.processMemoryCommand("efface toute ta mémoire")
                                testFeedback = result?.spokenMessage
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = JarvisRed)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Tout oublier", fontSize = 12.sp)
                    }
                }

                // Live Test Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val res = memoryCore.processMemoryCommand("retiens que je m'appelle Baki")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Nom = Baki", fontSize = 10.sp, color = JarvisCyanLight)
                    }

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val res = memoryCore.processMemoryCommand("retiens ma clé OPENROUTER_API_KEY=sk-12345")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Test Anti-Clé", fontSize = 10.sp, color = JarvisAmber)
                    }

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                val res = memoryCore.processMemoryCommand("statut de ta mémoire")
                                testFeedback = res?.spokenMessage
                            }
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Statut", fontSize = 10.sp, color = JarvisGreen)
                    }
                }
            }

            // Feedback Message Banner
            testFeedback?.let { feedback ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color.Black.copy(alpha = 0.4f))
                        .padding(8.dp)
                ) {
                    Text(
                        text = feedback,
                        color = JarvisCyanLight,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }

    // Add Memory Dialog
    if (showAddDialog) {
        AddMemoryDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { content, category ->
                scope.launch {
                    val res = memoryCore.longTermMemory.recordMemory(content = content, category = category)
                    if (res.isSuccess) {
                        testFeedback = "Souvenir enregistré : « $content »"
                    } else {
                        testFeedback = "Refus : ${res.exceptionOrNull()?.message}"
                    }
                    showAddDialog = false
                }
            }
        )
    }
}

@Composable
private fun CategoryFilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (isSelected) JarvisCyan.copy(alpha = 0.25f) else Color.Black.copy(alpha = 0.2f))
            .border(
                1.dp,
                if (isSelected) JarvisCyan else JarvisCyan.copy(alpha = 0.15f),
                RoundedCornerShape(6.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = if (isSelected) JarvisCyanLight else JarvisTextSecondary,
            fontSize = 10.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

@Composable
private fun MemoryItemRow(
    memory: MemoryEntity,
    onDelete: () -> Unit
) {
    val dateStr = remember(memory.updatedAt) {
        SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(Date(memory.updatedAt))
    }

    val catColor = when (MemoryCategory.fromString(memory.category)) {
        MemoryCategory.PREFERENCE -> JarvisCyan
        MemoryCategory.PERSONAL_INFO -> JarvisGreen
        MemoryCategory.PROJECT -> JarvisAmber
        MemoryCategory.ROUTINE -> Color(0xFFC084FC)
        else -> JarvisCyanLight
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Black.copy(alpha = 0.2f))
            .border(1.dp, JarvisCyan.copy(alpha = 0.1f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(catColor.copy(alpha = 0.2f))
                        .padding(horizontal = 5.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = memory.category,
                        color = catColor,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = dateStr,
                    color = JarvisTextSecondary,
                    fontSize = 10.sp
                )
            }
            Text(
                text = memory.content,
                color = JarvisTextPrimary,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )
        }

        IconButton(
            onClick = onDelete,
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Supprimer",
                tint = JarvisRed.copy(alpha = 0.7f),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun AddMemoryDialog(
    onDismiss: () -> Unit,
    onAdd: (content: String, category: MemoryCategory) -> Unit
) {
    var content by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(MemoryCategory.PREFERENCE) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouveau Souvenir JARVIS", color = JarvisCyanLight, fontSize = 16.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("Contenu du souvenir...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                Text("Catégorie :", fontSize = 12.sp, color = JarvisTextSecondary)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(MemoryCategory.entries) { cat ->
                        CategoryFilterChip(
                            label = cat.frenchLabel,
                            isSelected = selectedCategory == cat,
                            onClick = { selectedCategory = cat }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (content.isNotBlank()) onAdd(content, selectedCategory) },
                colors = ButtonDefaults.buttonColors(containerColor = JarvisCyan)
            ) {
                Text("Enregistrer", color = Color.Black)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = JarvisTextSecondary)
            }
        }
    )
}
