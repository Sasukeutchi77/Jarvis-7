package com.openjarvis.android.device.model

/**
 * Types of device actions that JARVIS can interpret and execute.
 */
enum class DeviceActionType {
    OPEN_APP,
    PHONE_CALL,
    SMS,
    VOLUME,
    BRIGHTNESS,
    FLASHLIGHT,
    CAMERA,
    SETTINGS,
    BATTERY,
    BLUETOOTH,
    WIFI,
    NAVIGATION,
    WEB_URL,
    DEVICE_STATUS,
    LOCK_DEVICE,
    UNKNOWN
}

/**
 * Classification tier for security policy.
 * SAFE_ACTION: Immediate execution if authorized.
 * SENSITIVE_ACTION: Requires explicit spoken/UI confirmation before proceeding.
 */
enum class ActionSecurityLevel {
    SAFE_ACTION,
    SENSITIVE_ACTION
}

/**
 * Execution outcome status for any device operation.
 */
enum class ActionResultStatus {
    SUCCESS,
    PERMISSION_REQUIRED,
    NOT_SUPPORTED,
    FAILED,
    CANCELLED,
    REQUIRES_CONFIRMATION
}

/**
 * Detailed result returned by any device controller operation.
 */
data class DeviceActionResult(
    val status: ActionResultStatus,
    val spokenMessage: String,
    val actionType: DeviceActionType,
    val details: Map<String, Any> = emptyMap(),
    val error: String? = null,
    val requiredPermission: String? = null,
    val fallbackIntentAction: String? = null
) {
    val isSuccess: Boolean get() = status == ActionResultStatus.SUCCESS
}

/**
 * Represents a pending sensitive action waiting for user confirmation.
 */
data class PendingConfirmation(
    val id: String,
    val prompt: String,
    val actionType: DeviceActionType,
    val targetDescription: String,
    val executeAction: suspend () -> DeviceActionResult,
    val createdAt: Long = System.currentTimeMillis()
)

/**
 * Status of an individual device hardware or system capability.
 */
enum class CapabilityState {
    AVAILABLE,
    PERMISSION_MISSING,
    SYSTEM_RESTRICTED,
    HARDWARE_UNAVAILABLE
}

/**
 * Device Capability descriptor.
 */
data class DeviceCapabilityInfo(
    val key: String,
    val name: String,
    val description: String,
    val state: CapabilityState,
    val minApiLevel: Int,
    val requiredPermission: String?,
    val settingsAction: String?
)
