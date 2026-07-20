package com.lightticket.sbb.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Pure black/white, high-contrast theme in the spirit of the Light Phone.
 * No colour carries meaning, so it reads cleanly on the LP III display.
 *
 * If your light-sdk fork ships its own theme/UI components, prefer those and
 * treat this as a fallback.
 */

private val Mono = Color(0xFF000000)
private val Paper = Color(0xFFFFFFFF)

private val LightColors = lightColorScheme(
    primary = Mono, onPrimary = Paper,
    background = Paper, onBackground = Mono,
    surface = Paper, onSurface = Mono,
    outline = Mono,
)

private val DarkColors = darkColorScheme(
    primary = Paper, onPrimary = Mono,
    background = Mono, onBackground = Paper,
    surface = Mono, onSurface = Paper,
    outline = Paper,
)

private val AppTypography = Typography(
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold),
    headlineSmall = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 18.sp),
    labelLarge = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold),
)

@Composable
fun SbbLightTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
