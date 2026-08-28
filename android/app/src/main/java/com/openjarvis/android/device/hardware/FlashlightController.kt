package com.openjarvis.android.device.hardware

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger

/**
 * Controller for hardware LED Torch / Flashlight using CameraManager API.
 */
class FlashlightController(private val context: Context) {

    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
    private var isTorchOn: Boolean = false
    private var cameraIdWithFlash: String? = null

    init {
        findCameraWithFlash()
        registerTorchCallback()
    }

    private fun findCameraWithFlash(): String? {
        val cm = cameraManager ?: return null
        return try {
            for (id in cm.cameraIdList) {
                val chars = cm.getCameraCharacteristics(id)
                val hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
                val facing = chars.get(CameraCharacteristics.LENS_FACING)
                if (hasFlash && facing == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraIdWithFlash = id
                    return id
                }
            }
            // Fallback to any camera with flash
            for (id in cm.cameraIdList) {
                val chars = cm.getCameraCharacteristics(id)
                if (chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true) {
                    cameraIdWithFlash = id
                    return id
                }
            }
            null
        } catch (e: Exception) {
            JarvisLogger.e("FlashlightController", "Error probing camera flash", e)
            null
        }
    }

    private fun registerTorchCallback() {
        cameraManager?.registerTorchCallback(object : CameraManager.TorchCallback() {
            override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                if (cameraId == cameraIdWithFlash) {
                    isTorchOn = enabled
                }
            }

            override fun onTorchModeUnavailable(cameraId: String) {
                if (cameraId == cameraIdWithFlash) {
                    isTorchOn = false
                }
            }
        }, null)
    }

    fun isFlashlightAvailable(): Boolean {
        val hasFeature = context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)
        return hasFeature && (cameraIdWithFlash != null || findCameraWithFlash() != null)
    }

    fun isTorchActive(): Boolean = isTorchOn

    fun setTorchMode(enable: Boolean): DeviceActionResult {
        val cm = cameraManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire de caméra est indisponible.",
            actionType = DeviceActionType.FLASHLIGHT,
            error = "CameraManager is null"
        )

        val targetCameraId = cameraIdWithFlash ?: findCameraWithFlash()
        if (targetCameraId == null) {
            return DeviceActionResult(
                status = ActionResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne dispose pas d'un flash matériel compatible.",
                actionType = DeviceActionType.FLASHLIGHT,
                error = "No camera with flash found"
            )
        }

        return try {
            cm.setTorchMode(targetCameraId, enable)
            isTorchOn = enable
            val msg = if (enable) "La lampe torche est allumée." else "La lampe torche est éteinte."
            JarvisLogger.i("FlashlightController", "Torch mode changed: enabled=$enable")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = msg,
                actionType = DeviceActionType.FLASHLIGHT,
                details = mapOf("torchActive" to enable, "cameraId" to targetCameraId)
            )
        } catch (e: CameraAccessException) {
            JarvisLogger.e("FlashlightController", "CameraAccessException toggling torch", e)
            val msg = when (e.reason) {
                CameraAccessException.CAMERA_IN_USE -> "La caméra est actuellement utilisée par une autre application. Impossible d'activer la torche."
                CameraAccessException.MAX_CAMERAS_IN_USE -> "Le capteur caméra est surchargé."
                CameraAccessException.CAMERA_DISABLED -> "L'accès à la caméra a été restreint par une stratégie système."
                else -> "Impossible d'accéder au flash matériel : ${e.message}"
            }
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = msg,
                actionType = DeviceActionType.FLASHLIGHT,
                error = e.message
            )
        } catch (e: Exception) {
            JarvisLogger.e("FlashlightController", "Unexpected error toggling torch", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Une erreur matérielle est survenue lors de l'activation de la lampe.",
                actionType = DeviceActionType.FLASHLIGHT,
                error = e.message
            )
        }
    }

    fun toggleTorch(): DeviceActionResult {
        return setTorchMode(!isTorchOn)
    }
}
