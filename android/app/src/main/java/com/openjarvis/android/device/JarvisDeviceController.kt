package com.openjarvis.android.device

import android.content.Context
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.device.apps.ApplicationResolver
import com.openjarvis.android.device.audio.AudioStreamType
import com.openjarvis.android.device.audio.AudioVolumeController
import com.openjarvis.android.device.contacts.ContactsController
import com.openjarvis.android.device.display.BrightnessController
import com.openjarvis.android.device.hardware.CameraController
import com.openjarvis.android.device.hardware.FlashlightController
import com.openjarvis.android.device.history.JarvisActionHistory
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.ActionSecurityLevel
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.device.model.PendingConfirmation
import com.openjarvis.android.device.navigation.NavigationController
import com.openjarvis.android.device.security.JarvisPermissionManager
import com.openjarvis.android.device.status.DeviceStateManager
import com.openjarvis.android.device.telephony.PhoneController
import com.openjarvis.android.device.telephony.SmsController
import com.openjarvis.android.device.web.WebUrlController
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

/**
 * Unified Central Controller for all Android hardware, applications, system intents,
 * audio, display, telephony, contacts, and security policies.
 * 
 * Pipeline:
 * VoiceEngine / HUD -> JarvisDeviceController -> JarvisCommandRouter -> Sub-Controllers -> Real Android OS APIs
 */
class JarvisDeviceController(private val context: Context) {

    val permissionManager = JarvisPermissionManager(context)
    val appResolver = ApplicationResolver(context)
    val volumeController = AudioVolumeController(context)
    val brightnessController = BrightnessController(context)
    val flashlightController = FlashlightController(context)
    val cameraController = CameraController(context)
    val contactsController = ContactsController(context)
    val phoneController = PhoneController(context, contactsController)
    val smsController = SmsController(context, contactsController)
    val stateManager = DeviceStateManager(context)
    val navigationController = NavigationController(context)
    val webController = WebUrlController(context)
    val router = JarvisCommandRouter()

    private val _pendingConfirmation = MutableStateFlow<PendingConfirmation?>(null)
    val pendingConfirmation: StateFlow<PendingConfirmation?> = _pendingConfirmation.asStateFlow()

    private val _lastActionResult = MutableStateFlow<DeviceActionResult?>(null)
    val lastActionResult: StateFlow<DeviceActionResult?> = _lastActionResult.asStateFlow()

    /**
     * Inspect and process a natural language query for deterministic Android device control.
     * Returns DeviceActionResult if handled by device subsystems, or null to delegate to conversational AI.
     */
    suspend fun processCommand(userUtterance: String): DeviceActionResult? = withContext(Dispatchers.Main) {
        val startTime = System.currentTimeMillis()
        val parsed = router.parse(userUtterance)

        // 1. Handle Pending Confirmation Response (e.g. "Oui", "Confirmer", "Non", "Annuler")
        val activePending = _pendingConfirmation.value
        if (activePending != null) {
            if (parsed.isConfirmationResponse) {
                JarvisLogger.i("JarvisDeviceController", "Executing confirmed sensitive action: ${activePending.actionType}")
                _pendingConfirmation.value = null
                JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(activePending.actionType.name, "EXECUTING"))

                val result = activePending.executeAction()
                recordAndEmit(userUtterance, activePending.actionType, result, startTime)
                return@withContext result
            } else if (parsed.isCancellationResponse) {
                JarvisLogger.i("JarvisDeviceController", "Cancelled sensitive action: ${activePending.actionType}")
                _pendingConfirmation.value = null
                val result = DeviceActionResult(
                    status = ActionResultStatus.CANCELLED,
                    spokenMessage = "Action annulée.",
                    actionType = activePending.actionType
                )
                recordAndEmit(userUtterance, activePending.actionType, result, startTime)
                return@withContext result
            }
        }

        // If unknown, return null so core AI handles conversational query
        if (parsed.actionType == DeviceActionType.UNKNOWN) {
            return@withContext null
        }

        JarvisLogger.i("JarvisDeviceController", "Routing device command: ${parsed.actionType} (Security: ${parsed.securityLevel})")
        JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(parsed.actionType.name, "EXECUTING"))

        val result: DeviceActionResult = when (parsed.actionType) {
            DeviceActionType.OPEN_APP -> {
                appResolver.launchApp(parsed.primaryParam)
            }
            DeviceActionType.BATTERY -> {
                stateManager.queryBatteryVoiceResponse()
            }
            DeviceActionType.FLASHLIGHT -> {
                if (parsed.booleanFlag != null) {
                    flashlightController.setTorchMode(parsed.booleanFlag)
                } else {
                    flashlightController.toggleTorch()
                }
            }
            DeviceActionType.VOLUME -> {
                when (parsed.primaryParam) {
                    "mute" -> volumeController.mute(AudioStreamType.MEDIA)
                    "unmute" -> volumeController.unmute(AudioStreamType.MEDIA)
                    "increase" -> volumeController.increaseVolume(AudioStreamType.MEDIA)
                    "decrease" -> volumeController.decreaseVolume(AudioStreamType.MEDIA)
                    "set" -> {
                        val pct = parsed.numericValue ?: 50
                        volumeController.setVolumePercentage(pct, AudioStreamType.MEDIA)
                    }
                    else -> {
                        val info = volumeController.getVolumeInfo(AudioStreamType.MEDIA)
                        DeviceActionResult(
                            status = ActionResultStatus.SUCCESS,
                            spokenMessage = "Le volume des médias est actuellement à ${info["percentage"]} %.",
                            actionType = DeviceActionType.VOLUME,
                            details = info
                        )
                    }
                }
            }
            DeviceActionType.BRIGHTNESS -> {
                when (parsed.primaryParam) {
                    "increase" -> brightnessController.increaseBrightness()
                    "decrease" -> brightnessController.decreaseBrightness()
                    "set" -> {
                        val pct = parsed.numericValue ?: 70
                        brightnessController.setBrightnessPercentage(pct)
                    }
                    else -> {
                        val cur = brightnessController.getCurrentBrightnessPercentage()
                        DeviceActionResult(
                            status = ActionResultStatus.SUCCESS,
                            spokenMessage = "La luminosité de l'écran est à $cur %.",
                            actionType = DeviceActionType.BRIGHTNESS,
                            details = mapOf("percentage" to cur)
                        )
                    }
                }
            }
            DeviceActionType.CAMERA -> {
                cameraController.openCamera(parsed.primaryParam)
            }
            DeviceActionType.PHONE_CALL -> {
                val callRes = phoneController.prepareCall(parsed.primaryParam, directCall = true)
                if (callRes.status == ActionResultStatus.REQUIRES_CONFIRMATION) {
                    val targetName = callRes.details["targetName"] as? String ?: parsed.primaryParam
                    val phoneNumber = callRes.details["phoneNumber"] as? String ?: ""
                    _pendingConfirmation.value = PendingConfirmation(
                        id = "call_${System.currentTimeMillis()}",
                        prompt = callRes.spokenMessage,
                        actionType = DeviceActionType.PHONE_CALL,
                        targetDescription = "$targetName ($phoneNumber)",
                        executeAction = {
                            phoneController.executeConfirmedCall(phoneNumber, targetName)
                        }
                    )
                }
                callRes
            }
            DeviceActionType.SMS -> {
                if (parsed.primaryParam == "open_app") {
                    smsController.openSmsApp()
                } else {
                    val smsRes = smsController.prepareSms(parsed.primaryParam, parsed.secondaryParam, autoSendIfConfirmed = true)
                    if (smsRes.status == ActionResultStatus.REQUIRES_CONFIRMATION) {
                        val recipientName = smsRes.details["recipientName"] as? String ?: parsed.primaryParam
                        val phoneNumber = smsRes.details["phoneNumber"] as? String ?: ""
                        val body = smsRes.details["messageBody"] as? String ?: parsed.secondaryParam
                        _pendingConfirmation.value = PendingConfirmation(
                            id = "sms_${System.currentTimeMillis()}",
                            prompt = smsRes.spokenMessage,
                            actionType = DeviceActionType.SMS,
                            targetDescription = "$recipientName : $body",
                            executeAction = {
                                smsController.sendConfirmedSms(phoneNumber, recipientName, body)
                            }
                        )
                    }
                    smsRes
                }
            }
            DeviceActionType.BLUETOOTH -> {
                navigationController.handleBluetoothCommand(parsed.booleanFlag)
            }
            DeviceActionType.WIFI -> {
                navigationController.handleWifiCommand(parsed.booleanFlag)
            }
            DeviceActionType.NAVIGATION -> {
                if (parsed.primaryParam == "home") {
                    navigationController.goHome()
                } else {
                    navigationController.openRecentApps()
                }
            }
            DeviceActionType.LOCK_DEVICE -> {
                navigationController.lockDevice()
            }
            DeviceActionType.SETTINGS -> {
                navigationController.openSettingsPage(parsed.primaryParam)
            }
            DeviceActionType.DEVICE_STATUS -> {
                stateManager.queryFullStateVoiceResponse()
            }
            DeviceActionType.WEB_URL -> {
                if (parsed.secondaryParam == "search") {
                    webController.searchWeb(parsed.primaryParam)
                } else {
                    webController.openUrl(parsed.primaryParam)
                }
            }
            DeviceActionType.UNKNOWN -> {
                DeviceActionResult(
                    status = ActionResultStatus.NOT_SUPPORTED,
                    spokenMessage = "Action non reconnue.",
                    actionType = DeviceActionType.UNKNOWN
                )
            }
        }

        recordAndEmit(userUtterance, parsed.actionType, result, startTime)
        return@withContext result
    }

    private fun recordAndEmit(
        command: String,
        actionType: DeviceActionType,
        result: DeviceActionResult,
        startTime: Long
    ) {
        val latency = System.currentTimeMillis() - startTime
        _lastActionResult.value = result

        JarvisActionHistory.record(
            command = command,
            actionType = actionType,
            status = result.status,
            message = result.spokenMessage,
            latencyMs = latency
        )

        val eventStatus = if (result.isSuccess) "SUCCESS" else if (result.status == ActionResultStatus.REQUIRES_CONFIRMATION) "WAITING_CONFIRMATION" else "ERROR"
        JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(actionType.name, eventStatus))
    }

    fun clearPendingConfirmation() {
        _pendingConfirmation.value = null
    }
}
