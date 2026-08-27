package com.openjarvis.android.services

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import com.openjarvis.android.logging.JarvisLogger

/**
 * Official Android VoiceInteractionService implementation for JARVIS.
 * Allows JARVIS to act as the primary system assistant when selected by the user
 * in Android Settings -> Default apps -> Digital Assistant app.
 */
class JarvisVoiceInteractionService : VoiceInteractionService() {

    override fun onCreate() {
        super.onCreate()
        JarvisLogger.i("JarvisVoiceInteraction", "JarvisVoiceInteractionService created.")
    }

    override fun onReady() {
        super.onReady()
        JarvisLogger.i("JarvisVoiceInteraction", "JarvisVoiceInteractionService is ready.")
    }

    override fun onShutdown() {
        JarvisLogger.i("JarvisVoiceInteraction", "JarvisVoiceInteractionService shutdown.")
        super.onShutdown()
    }

    companion object {
        fun isActive(context: Context): Boolean {
            return isActiveService(context, JarvisVoiceInteractionService::class.java.name)
        }
    }
}
