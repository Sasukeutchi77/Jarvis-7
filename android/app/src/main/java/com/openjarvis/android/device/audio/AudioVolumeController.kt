package com.openjarvis.android.device.audio

import android.content.Context
import android.media.AudioManager
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import kotlin.math.roundToInt

enum class AudioStreamType(val streamId: Int, val displayName: String) {
    MEDIA(AudioManager.STREAM_MUSIC, "médias"),
    RING(AudioManager.STREAM_RING, "sonnerie"),
    ALARM(AudioManager.STREAM_ALARM, "alarme"),
    NOTIFICATION(AudioManager.STREAM_NOTIFICATION, "notifications")
}

/**
 * Controller for granular Android audio stream manipulation using AudioManager.
 */
class AudioVolumeController(private val context: Context) {

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

    fun getVolumeInfo(streamType: AudioStreamType = AudioStreamType.MEDIA): Map<String, Int> {
        val am = audioManager ?: return emptyMap()
        val current = am.getStreamVolume(streamType.streamId)
        val max = am.getStreamMaxVolume(streamType.streamId)
        val percent = if (max > 0) ((current.toFloat() / max.toFloat()) * 100f).roundToInt() else 0
        return mapOf(
            "current" to current,
            "max" to max,
            "percentage" to percent
        )
    }

    /**
     * Set volume percentage (0 to 100) for a given audio stream.
     */
    fun setVolumePercentage(percentage: Int, streamType: AudioStreamType = AudioStreamType.MEDIA): DeviceActionResult {
        val am = audioManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire audio système est indisponible.",
            actionType = DeviceActionType.VOLUME,
            error = "AudioManager is null"
        )

        val clamped = percentage.coerceIn(0, 100)
        val max = am.getStreamMaxVolume(streamType.streamId)
        val targetIndex = ((clamped / 100f) * max).roundToInt().coerceIn(0, max)

        return try {
            am.setStreamVolume(streamType.streamId, targetIndex, AudioManager.FLAG_SHOW_UI)
            JarvisLogger.i("AudioVolumeController", "Set ${streamType.displayName} volume to $clamped% (index $targetIndex/$max)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Le volume des ${streamType.displayName} est réglé à $clamped %.",
                actionType = DeviceActionType.VOLUME,
                details = mapOf("stream" to streamType.name, "percentage" to clamped, "index" to targetIndex)
            )
        } catch (e: Exception) {
            JarvisLogger.e("AudioVolumeController", "Failed to set volume", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible de régler le volume : ${e.message}",
                actionType = DeviceActionType.VOLUME,
                error = e.message
            )
        }
    }

    /**
     * Increment volume step.
     */
    fun increaseVolume(streamType: AudioStreamType = AudioStreamType.MEDIA): DeviceActionResult {
        val am = audioManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire audio système est indisponible.",
            actionType = DeviceActionType.VOLUME,
            error = "AudioManager is null"
        )

        return try {
            am.adjustStreamVolume(streamType.streamId, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
            val info = getVolumeInfo(streamType)
            val percent = info["percentage"] ?: 0
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Volume augmenté à $percent %.",
                actionType = DeviceActionType.VOLUME,
                details = info
            )
        } catch (e: Exception) {
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Erreur lors de l'augmentation du volume : ${e.message}",
                actionType = DeviceActionType.VOLUME,
                error = e.message
            )
        }
    }

    /**
     * Decrement volume step.
     */
    fun decreaseVolume(streamType: AudioStreamType = AudioStreamType.MEDIA): DeviceActionResult {
        val am = audioManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire audio système est indisponible.",
            actionType = DeviceActionType.VOLUME,
            error = "AudioManager is null"
        )

        return try {
            am.adjustStreamVolume(streamType.streamId, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
            val info = getVolumeInfo(streamType)
            val percent = info["percentage"] ?: 0
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Volume diminué à $percent %.",
                actionType = DeviceActionType.VOLUME,
                details = info
            )
        } catch (e: Exception) {
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Erreur lors de la réduction du volume : ${e.message}",
                actionType = DeviceActionType.VOLUME,
                error = e.message
            )
        }
    }

    /**
     * Mute audio stream or activate silent ringer mode.
     */
    fun mute(streamType: AudioStreamType = AudioStreamType.MEDIA, silentPhone: Boolean = false): DeviceActionResult {
        val am = audioManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire audio système est indisponible.",
            actionType = DeviceActionType.VOLUME,
            error = "AudioManager is null"
        )

        return try {
            if (silentPhone) {
                am.ringerMode = AudioManager.RINGER_MODE_SILENT
                DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = "Le téléphone est maintenant en mode silencieux.",
                    actionType = DeviceActionType.VOLUME,
                    details = mapOf("ringerMode" to "SILENT")
                )
            } else {
                am.setStreamVolume(streamType.streamId, 0, AudioManager.FLAG_SHOW_UI)
                DeviceActionResult(
                    status = ActionResultStatus.SUCCESS,
                    spokenMessage = "Le son des ${streamType.displayName} est coupé.",
                    actionType = DeviceActionType.VOLUME,
                    details = mapOf("stream" to streamType.name, "muted" to true)
                )
            }
        } catch (e: Exception) {
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible de couper le son : ${e.message}",
                actionType = DeviceActionType.VOLUME,
                error = e.message
            )
        }
    }

    /**
     * Unmute or restore normal ringer mode.
     */
    fun unmute(streamType: AudioStreamType = AudioStreamType.MEDIA): DeviceActionResult {
        val am = audioManager ?: return DeviceActionResult(
            status = ActionResultStatus.FAILED,
            spokenMessage = "Le gestionnaire audio système est indisponible.",
            actionType = DeviceActionType.VOLUME,
            error = "AudioManager is null"
        )

        return try {
            am.ringerMode = AudioManager.RINGER_MODE_NORMAL
            val max = am.getStreamMaxVolume(streamType.streamId)
            val half = (max / 2).coerceAtLeast(1)
            am.setStreamVolume(streamType.streamId, half, AudioManager.FLAG_SHOW_UI)
            val info = getVolumeInfo(streamType)
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Le son est rétabli à ${info["percentage"]} %.",
                actionType = DeviceActionType.VOLUME,
                details = info
            )
        } catch (e: Exception) {
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Erreur lors du rétablissement du son : ${e.message}",
                actionType = DeviceActionType.VOLUME,
                error = e.message
            )
        }
    }
}
