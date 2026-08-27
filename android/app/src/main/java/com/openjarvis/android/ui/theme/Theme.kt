package com.openjarvis.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = JarvisCyanLight,
    onPrimary = JarvisDarkBg,
    primaryContainer = JarvisCyan,
    onPrimaryContainer = JarvisTextPrimary,
    secondary = JarvisCyan,
    onSecondary = JarvisTextPrimary,
    background = JarvisDarkBg,
    onBackground = JarvisTextPrimary,
    surface = JarvisSurfaceDark,
    onSurface = JarvisTextPrimary,
    surfaceVariant = JarvisCardDark,
    onSurfaceVariant = JarvisTextSecondary
)

@Composable
fun OpenJarvisTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
