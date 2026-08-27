package com.openjarvis.android.services

import android.app.assist.AssistContent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import com.openjarvis.android.MainActivity
import com.openjarvis.android.logging.JarvisLogger
import java.io.ByteArrayOutputStream

/**
 * Official VoiceInteractionSession for JARVIS.
 * Receives the active on-screen assist structure and screenshot from the Android system
 * when the user summons JARVIS via long-press Home or power button.
 */
class JarvisVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {

    companion object {
        var lastAssistPackage: String? = null
        var lastAssistText: String? = null
        var lastAssistScreenshotBase64: String? = null
    }

    override fun onCreate() {
        super.onCreate()
        JarvisLogger.i("JarvisVoiceSession", "VoiceInteractionSession created.")
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        JarvisLogger.i("JarvisVoiceSession", "VoiceInteractionSession onShow triggered with flags: $showFlags")

        // Launch or bring JARVIS overlay / interface to foreground with voice prompt
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("EXTRA_VOICE_ASSIST_TRIGGERED", true)
        }
        context.startActivity(intent)

        try {
            com.openjarvis.android.JarvisApplication.instance.voiceEngine.startListeningForCommand()
        } catch (e: Exception) {
            JarvisLogger.e("JarvisVoiceSession", "Error starting voice command on session show", e)
        }
    }

    override fun onHandleAssist(
        data: Bundle?,
        structure: AssistStructure?,
        content: AssistContent?
    ) {
        super.onHandleAssist(data, structure, content)
        JarvisLogger.i("JarvisVoiceSession", "Received AssistStructure from Android OS.")

        try {
            val textBuilder = StringBuilder()
            structure?.let { struct ->
                for (i in 0 until struct.windowNodeCount) {
                    val windowNode = struct.getWindowNodeAt(i)
                    val root = windowNode.rootViewNode
                    traverseNode(root, textBuilder)
                }
            }

            lastAssistText = textBuilder.toString().trim()
            if (lastAssistText?.isNotEmpty() == true) {
                JarvisLogger.i("JarvisVoiceSession", "Extracted Assist text: ${lastAssistText?.take(120)}...")
            }
        } catch (e: Exception) {
            JarvisLogger.e("JarvisVoiceSession", "Error parsing AssistStructure", e)
        }
    }

    override fun onHandleScreenshot(screenshot: Bitmap?) {
        super.onHandleScreenshot(screenshot)
        if (screenshot != null) {
            try {
                val outputStream = ByteArrayOutputStream()
                screenshot.compress(Bitmap.CompressFormat.JPEG, 75, outputStream)
                val bytes = outputStream.toByteArray()
                lastAssistScreenshotBase64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                JarvisLogger.i("JarvisVoiceSession", "Captured assist screenshot of size: ${bytes.size} bytes.")
            } catch (e: Exception) {
                JarvisLogger.e("JarvisVoiceSession", "Error encoding assist screenshot", e)
            }
        }
    }

    private fun traverseNode(node: AssistStructure.ViewNode?, outText: StringBuilder) {
        if (node == null) return
        val text = node.text?.toString()?.trim()
        val desc = node.contentDescription?.toString()?.trim()
        if (!text.isNullOrEmpty()) {
            outText.append(text).append("\n")
        } else if (!desc.isNullOrEmpty()) {
            outText.append(desc).append("\n")
        }

        for (i in 0 until node.childCount) {
            traverseNode(node.getChildAt(i), outText)
        }
    }
}
