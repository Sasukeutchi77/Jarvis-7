package com.openjarvis.android.navigation

sealed class Screen(val route: String, val title: String) {
    object VoiceHud : Screen("voice_hud", "Voice HUD")
    object Chat : Screen("chat", "Workspace")
    object Memory : Screen("memory", "Memory")
    object Settings : Screen("settings", "Settings")
}
