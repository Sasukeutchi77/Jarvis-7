package com.openjarvis.android.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.openjarvis.android.logging.JarvisLogger

/**
 * JARVIS Core Accessibility Service
 * Grants JARVIS deep visual and contextual awareness of all on-screen content
 * across third-party Android applications, with automated interaction capability.
 */
class JarvisAccessibilityService : AccessibilityService() {

    companion object {
        var instance: JarvisAccessibilityService? = null
            private set

        var lastCapturedScreenText: String = ""
            private set

        var currentForegroundPackage: String = ""
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        JarvisLogger.i("AccessibilityService", "JARVIS Accessibility Service connected & active.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: ""
        if (packageName.isNotEmpty()) {
            currentForegroundPackage = packageName
        }

        // Inspect and collect visible text nodes across active window
        rootInActiveWindow?.let { rootNode ->
            val collectedText = StringBuilder()
            extractNodeText(rootNode, collectedText)
            lastCapturedScreenText = collectedText.toString()
        }
    }

    private fun extractNodeText(node: AccessibilityNodeInfo?, builder: StringBuilder) {
        if (node == null) return
        node.text?.let { text ->
            if (text.isNotBlank()) {
                builder.append(text).append("\n")
            }
        }
        node.contentDescription?.let { desc ->
            if (desc.isNotBlank() && desc != node.text) {
                builder.append("[UI: ").append(desc).append("]\n")
            }
        }

        for (i in 0 until node.childCount) {
            extractNodeText(node.getChild(i), builder)
        }
    }

    /**
     * Perform automated click/tap gesture on coordinates
     */
    fun performTapGesture(x: Float, y: Float, onComplete: ((Boolean) -> Unit)? = null) {
        val path = Path().apply {
            moveTo(x, y)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()

        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                JarvisLogger.i("AccessibilityService", "Gesture dispatched successfully at ($x, $y)")
                onComplete?.invoke(true)
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                JarvisLogger.w("AccessibilityService", "Gesture cancelled at ($x, $y)")
                onComplete?.invoke(false)
            }
        }, null)
    }

    /**
     * Perform global hardware / system action (Home, Back, Recents, Notifications)
     */
    fun performGlobalSystemAction(actionId: Int): Boolean {
        return performGlobalAction(actionId)
    }

    override fun onInterrupt() {
        JarvisLogger.w("AccessibilityService", "JARVIS Accessibility Service interrupted.")
    }

    override fun onDestroy() {
        instance = null
        JarvisLogger.i("AccessibilityService", "JARVIS Accessibility Service destroyed.")
        super.onDestroy()
    }
}
