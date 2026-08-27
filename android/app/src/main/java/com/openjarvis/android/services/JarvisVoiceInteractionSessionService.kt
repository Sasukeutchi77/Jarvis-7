package com.openjarvis.android.services

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import com.openjarvis.android.logging.JarvisLogger

class JarvisVoiceInteractionSessionService : VoiceInteractionSessionService() {

    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        JarvisLogger.i("VoiceInteractionSession", "Creating new JarvisVoiceInteractionSession...")
        return JarvisVoiceInteractionSession(this)
    }
}
