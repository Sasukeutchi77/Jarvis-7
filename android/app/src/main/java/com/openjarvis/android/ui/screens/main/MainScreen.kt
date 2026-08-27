package com.openjarvis.android.ui.screens.main

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.openjarvis.android.JarvisApplication
import com.openjarvis.android.navigation.Screen
import com.openjarvis.android.ui.screens.chat.ChatScreen
import com.openjarvis.android.ui.screens.memory.MemoryScreen
import com.openjarvis.android.ui.screens.settings.SettingsScreen
import com.openjarvis.android.ui.screens.voice.VoiceHudScreen
import com.openjarvis.android.ui.theme.JarvisCyan
import com.openjarvis.android.ui.theme.JarvisCyanLight
import com.openjarvis.android.ui.theme.JarvisDarkBg
import com.openjarvis.android.ui.theme.JarvisGreen
import com.openjarvis.android.ui.theme.JarvisSurfaceDark
import com.openjarvis.android.ui.theme.JarvisTextPrimary
import com.openjarvis.android.ui.theme.JarvisTextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen() {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.VoiceHud) }
    val lifecycleManager = JarvisApplication.instance.lifecycleManager
    val healthState by lifecycleManager.healthState.collectAsState()
    val config by JarvisApplication.instance.configManager.config.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "OPENJARVIS",
                            color = JarvisTextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(JarvisGreen)
                                .size(8.dp)
                        )
                    }
                },
                actions = {
                    // System Pulse Info
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(end = 16.dp)
                    ) {
                        Text(
                            text = "${config.executionMode.name} • ${healthState.batteryPercentage}%",
                            color = JarvisCyanLight,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = JarvisDarkBg
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = JarvisSurfaceDark,
                modifier = Modifier.border(1.dp, JarvisCyan.copy(alpha = 0.15f), CircleShape)
            ) {
                val navItems = listOf(
                    Triple(Screen.VoiceHud, Icons.Default.GraphicEq, "Voice"),
                    Triple(Screen.Chat, Icons.Default.Chat, "Chat"),
                    Triple(Screen.Memory, Icons.Default.Folder, "Mémoire"),
                    Triple(Screen.Settings, Icons.Default.Settings, "Config")
                )

                navItems.forEach { (screen, icon, label) ->
                    val isSelected = currentScreen == screen
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentScreen = screen },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = JarvisCyanLight,
                            selectedTextColor = JarvisCyanLight,
                            unselectedIconColor = JarvisTextSecondary,
                            unselectedTextColor = JarvisTextSecondary,
                            indicatorColor = JarvisCyan.copy(alpha = 0.2f)
                        )
                    )
                }
            }
        },
        containerColor = JarvisDarkBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentScreen) {
                Screen.VoiceHud -> VoiceHudScreen()
                Screen.Chat -> ChatScreen()
                Screen.Memory -> MemoryScreen()
                Screen.Settings -> SettingsScreen()
            }
        }
    }
}
