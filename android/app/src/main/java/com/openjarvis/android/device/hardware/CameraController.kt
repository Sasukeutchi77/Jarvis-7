package com.openjarvis.android.device.hardware

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.MediaStore
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger

/**
 * Controller for Android Camera viewfinder and capture intents.
 * Strictly respects user privacy: always presents the official camera interface, never takes silent background photos.
 */
class CameraController(private val context: Context) {

    fun hasCameraHardware(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
    }

    /**
     * Launch default camera app viewfinder.
     */
    fun openCamera(mode: String = "photo"): DeviceActionResult {
        if (!hasCameraHardware()) {
            return DeviceActionResult(
                status = ActionResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne dispose pas d'un capteur photo.",
                actionType = DeviceActionType.CAMERA,
                error = "No camera hardware"
            )
        }

        val actionIntent = when (mode.lowercase()) {
            "video", "vidéo" -> Intent(MediaStore.ACTION_VIDEO_CAPTURE)
            else -> Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
        }

        actionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        return try {
            if (actionIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(actionIntent)
                JarvisLogger.i("CameraController", "Camera app opened successfully in mode: $mode")
                DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = if (mode.contains("vidéo") || mode.contains("video")) {
                        "J'ouvre l'enregistreur vidéo."
                    } else {
                        "J'ouvre l'appareil photo."
                    },
                    actionType = DeviceActionType.CAMERA,
                    details = mapOf("mode" to mode)
                )
            } else {
                // Fallback to general image capture intent
                val fallbackIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallbackIntent)
                DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = "J'ouvre l'appareil photo.",
                    actionType = DeviceActionType.CAMERA
                )
            }
        } catch (e: Exception) {
            JarvisLogger.e("CameraController", "Error launching camera intent", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ouvrir l'appareil photo : ${e.message}",
                actionType = DeviceActionType.CAMERA,
                error = e.message
            )
        }
    }
}
