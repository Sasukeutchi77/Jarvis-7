package com.openjarvis.android.ui.screens.memory

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
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
import com.openjarvis.android.storage.database.entity.DocumentEntity
import com.openjarvis.android.storage.database.entity.MemoryCategory
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MemoryScreen() {
    val memoryManager = JarvisApplication.instance.personalMemoryManager
    val configManager = JarvisApplication.instance.configManager

    val appConfig by configManager.config.collectAsState()
    val isMemoryActive = appConfig.memoryEnabled

    val allMemories by memoryManager.observeAllMemories().collectAsState(initial = emptyList())
    val memoryCount by memoryManager.observeMemoryCount().collectAsState(initial = 0)

    val scope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedCategoryFilter by remember { mutableStateOf<MemoryCategory?>(null) }

    // Dialog States
    var showAddDialog by remember { mutableStateOf(false) }
    var editingDocument by remember { mutableStateOf<DocumentEntity?>(null) }
    var showClearAllConfirmDialog by remember { mutableStateOf(false) }

    val filteredMemories = allMemories.filter { doc ->
        val matchesCategory = selectedCategoryFilter == null || doc.category == selectedCategoryFilter?.name
        val matchesSearch = if (searchQuery.isBlank()) true else {
            doc.content.contains(searchQuery, ignoreCase = true) ||
            doc.source.contains(searchQuery, ignoreCase = true) ||
            doc.category.contains(searchQuery, ignoreCase = true)
        }
        matchesCategory && matchesSearch
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Header / Master Switch
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                border = androidx.compose.foundation.BorderStroke(1.dp, JarvisCyan.copy(alpha = 0.25f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(JarvisCyan.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Psychology,
                                contentDescription = null,
                                tint = JarvisCyanLight
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "MÉMOIRE PERSONNELLE",
                                color = JarvisCyanLight,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = if (isMemoryActive) "$memoryCount souvenir(s) persisté(s) (FTS5 Local)" else "Système de mémoire en pause",
                                color = if (isMemoryActive) JarvisTextSecondary else Color.Red.copy(alpha = 0.7f),
                                fontSize = 11.sp
                            )
                        }
                    }

                    Switch(
                        checked = isMemoryActive,
                        onCheckedChange = { active ->
                            scope.launch {
                                memoryManager.setMemoryEnabled(active)
                            }
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = JarvisCyanLight,
                            checkedTrackColor = JarvisCyan.copy(alpha = 0.5f)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Search Bar & Wipe Action
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Rechercher dans les souvenirs...", fontSize = 13.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = JarvisCyan) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = JarvisCyanLight,
                        unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                    ),
                    singleLine = true
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = { showClearAllConfirmDialog = true },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.Red.copy(alpha = 0.15f))
                        .border(1.dp, Color.Red.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteSweep,
                        contentDescription = "Tout effacer",
                        tint = Color.Red.copy(alpha = 0.9f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Category Filter Chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                item {
                    CategoryChip(
                        label = "Tous",
                        isSelected = selectedCategoryFilter == null,
                        onClick = { selectedCategoryFilter = null }
                    )
                }
                items(MemoryCategory.values()) { cat ->
                    val label = when (cat) {
                        MemoryCategory.PREFERENCE -> "Préférences"
                        MemoryCategory.HABIT -> "Habitudes"
                        MemoryCategory.IMPORTANT_FACT -> "Faits Importants"
                        MemoryCategory.USER_PROFILE -> "Profil"
                        MemoryCategory.CONVERSATION_CONTEXT -> "Contexte"
                        MemoryCategory.AUTOMATION_NOTE -> "Automatisations"
                    }
                    CategoryChip(
                        label = label,
                        isSelected = selectedCategoryFilter == cat,
                        onClick = {
                            selectedCategoryFilter = if (selectedCategoryFilter == cat) null else cat
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // List of Memories
            if (filteredMemories.isEmpty()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Psychology,
                            contentDescription = null,
                            tint = JarvisTextSecondary.copy(alpha = 0.4f),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (searchQuery.isNotBlank()) "Aucun souvenir trouvé pour cette recherche" else "Aucun souvenir enregistré",
                            color = JarvisTextSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredMemories, key = { it.id }) { doc ->
                        MemoryItemCard(
                            document = doc,
                            onEdit = { editingDocument = doc },
                            onDelete = {
                                scope.launch {
                                    memoryManager.deleteMemory(doc.id)
                                }
                            }
                        )
                    }
                }
            }
        }

        // Floating Action Button to Add Memory manually
        FloatingActionButton(
            onClick = { showAddDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(20.dp),
            containerColor = JarvisCyanLight,
            contentColor = Color.Black
        ) {
            Icon(Icons.Default.Add, contentDescription = "Ajouter un souvenir")
        }
    }

    // Dialog: Add Memory
    if (showAddDialog) {
        MemoryEditDialog(
            title = "Nouveau Souvenir",
            initialContent = "",
            initialCategory = MemoryCategory.IMPORTANT_FACT,
            onDismiss = { showAddDialog = false },
            onConfirm = { content, category, isSensitive ->
                scope.launch {
                    memoryManager.recordMemory(
                        content = content,
                        source = "Entrée Manuelle Utilisateur",
                        category = category,
                        isSensitive = isSensitive
                    )
                    showAddDialog = false
                }
            }
        )
    }

    // Dialog: Edit Memory
    editingDocument?.let { doc ->
        val currentCategory = try {
            MemoryCategory.valueOf(doc.category)
        } catch (e: Exception) {
            MemoryCategory.IMPORTANT_FACT
        }

        MemoryEditDialog(
            title = "Modifier le Souvenir",
            initialContent = doc.content,
            initialCategory = currentCategory,
            isEditing = true,
            onDismiss = { editingDocument = null },
            onConfirm = { newContent, newCategory, _ ->
                scope.launch {
                    memoryManager.updateMemory(
                        id = doc.id,
                        content = newContent,
                        category = newCategory
                    )
                    editingDocument = null
                }
            }
        )
    }

    // Dialog: Wipe All Confirmation
    if (showClearAllConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showClearAllConfirmDialog = false },
            title = { Text("Effacer toute la mémoire ?", color = JarvisTextPrimary) },
            text = {
                Text(
                    "Cette action supprimera définitivement tous les souvenirs, préférences et contextes FTS5 enregistrés sur l'appareil. Êtes-vous certain ?",
                    color = JarvisTextSecondary,
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            memoryManager.clearAllMemory()
                            showClearAllConfirmDialog = false
                        }
                    }
                ) {
                    Text("Tout effacer", color = Color.Red, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearAllConfirmDialog = false }) {
                    Text("Annuler", color = JarvisCyanLight)
                }
            },
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }
}

@Composable
fun CategoryChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                if (isSelected) JarvisCyan.copy(alpha = 0.4f)
                else MaterialTheme.colorScheme.surfaceVariant
            )
            .border(
                1.dp,
                if (isSelected) JarvisCyanLight else JarvisCyan.copy(alpha = 0.2f),
                RoundedCornerShape(20.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
            color = if (isSelected) JarvisCyanLight else JarvisTextSecondary
        )
    }
}

@Composable
fun MemoryItemCard(
    document: DocumentEntity,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val dateFormatted = remember(document.updatedAt) {
        SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.FRENCH).format(Date(document.updatedAt))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        border = androidx.compose.foundation.BorderStroke(1.dp, JarvisCyan.copy(alpha = 0.15f))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(JarvisCyan.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = document.category.replace("_", " "),
                            color = JarvisCyanLight,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    if (document.isEncrypted) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = "Chiffré",
                            tint = JarvisCyanLight,
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = dateFormatted,
                        color = JarvisTextSecondary,
                        fontSize = 10.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = onEdit,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Modifier",
                            tint = JarvisCyanLight,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Supprimer",
                            tint = Color.Red.copy(alpha = 0.8f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = document.content,
                color = JarvisTextPrimary,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Source : ${document.source}",
                color = JarvisTextSecondary.copy(alpha = 0.7f),
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun MemoryEditDialog(
    title: String,
    initialContent: String,
    initialCategory: MemoryCategory,
    isEditing: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (content: String, category: MemoryCategory, isSensitive: Boolean) -> Unit
) {
    var content by remember { mutableStateOf(initialContent) }
    var selectedCategory by remember { mutableStateOf(initialCategory) }
    var isSensitive by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, color = JarvisTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Catégorie :", color = JarvisTextSecondary, fontSize = 11.sp)
                Spacer(modifier = Modifier.height(4.dp))
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(MemoryCategory.values()) { cat ->
                        val isSel = selectedCategory == cat
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSel) JarvisCyan.copy(alpha = 0.4f) else MaterialTheme.colorScheme.surface)
                                .border(1.dp, if (isSel) JarvisCyanLight else Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                                .clickable { selectedCategory = cat }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = cat.name.replace("_", " "),
                                fontSize = 10.sp,
                                color = if (isSel) JarvisCyanLight else JarvisTextSecondary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    placeholder = { Text("Contenu du souvenir ou fait à mémoriser...", fontSize = 12.sp) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = JarvisCyanLight,
                        unfocusedBorderColor = JarvisCyan.copy(alpha = 0.3f)
                    ),
                    maxLines = 5
                )

                if (!isEditing) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Switch(
                            checked = isSensitive,
                            onCheckedChange = { isSensitive = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = JarvisCyanLight,
                                checkedTrackColor = JarvisCyan.copy(alpha = 0.5f)
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Donnée hautement confidentielle (Chiffrement)",
                            fontSize = 11.sp,
                            color = JarvisTextSecondary
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (content.isNotBlank()) {
                        onConfirm(content.trim(), selectedCategory, isSensitive)
                    }
                }
            ) {
                Text("Enregistrer", color = JarvisCyanLight, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = JarvisTextSecondary)
            }
        },
        containerColor = MaterialTheme.colorScheme.surfaceVariant
    )
}
