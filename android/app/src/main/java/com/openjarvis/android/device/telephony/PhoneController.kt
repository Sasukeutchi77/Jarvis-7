package com.openjarvis.android.device.telephony

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import com.openjarvis.android.device.contacts.ContactsController
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger

/**
 * Controller for placing phone calls and preparing the Android system dialer.
 * Classifies phone calls as sensitive operations requiring clear intent and confirmation.
 */
class PhoneController(
    private val context: Context,
    private val contactsController: ContactsController
) {

    fun hasTelephonyHardware(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    }

    fun hasCallPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Resolve target contact or number from voice command and prepare phone call.
     */
    suspend fun prepareCall(target: String, directCall: Boolean = false): DeviceActionResult {
        if (!hasTelephonyHardware()) {
            return DeviceActionResult(
                status = ActionResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne dispose pas d'une fonction de téléphonie cellulaire.",
                actionType = DeviceActionType.PHONE_CALL,
                error = "No telephony feature"
            )
        }

        val cleanedTarget = target
            .replaceFirst(Regex("^(appelle|appeler|compose|composer|téléphone à|telephone a)\\s+", RegexOption.IGNORE_CASE), "")
            .trim()

        if (cleanedTarget.isBlank()) {
            return DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Veuillez préciser le nom du contact ou le numéro à appeler.",
                actionType = DeviceActionType.PHONE_CALL,
                error = "Target is empty"
            )
        }

        // Check if target is a raw phone number (e.g. +33612345678 or 0612345678)
        val isRawNumber = cleanedTarget.replace(" ", "").replace("-", "").matches(Regex("^\\+?[0-9]{3,15}$"))
        val targetNumber: String
        val targetName: String

        if (isRawNumber) {
            targetNumber = cleanedTarget.replace(" ", "")
            targetName = targetNumber
        } else {
            val contact = contactsController.findFirstContactMatch(cleanedTarget)
            if (contact == null) {
                return DeviceActionResult(
                    status = ActionResultStatus.NOT_SUPPORTED,
                    spokenMessage = "Je n'ai pas trouvé de contact correspondant à \"$cleanedTarget\" dans votre répertoire.",
                    actionType = DeviceActionType.PHONE_CALL,
                    error = "Contact not found"
                )
            }
            targetNumber = contact.phoneNumber
            targetName = contact.displayName
        }

        if (directCall && hasCallPermission()) {
            return DeviceActionResult(
                status = ActionResultStatus.REQUIRES_CONFIRMATION,
                spokenMessage = "Je vais appeler $targetName au $targetNumber. Confirmer ?",
                actionType = DeviceActionType.PHONE_CALL,
                details = mapOf("targetName" to targetName, "phoneNumber" to targetNumber, "directCall" to true)
            )
        } else {
            // Open system dialer safely without auto-calling
            return openDialer(targetNumber, targetName)
        }
    }

    /**
     * Executes the direct call after explicit user confirmation.
     */
    fun executeConfirmedCall(phoneNumber: String, targetName: String): DeviceActionResult {
        if (!hasCallPermission()) {
            return openDialer(phoneNumber, targetName)
        }

        return try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$phoneNumber")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(callIntent)
            JarvisLogger.i("PhoneController", "Initiated direct call to $targetName ($phoneNumber)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Appel en cours vers $targetName.",
                actionType = DeviceActionType.PHONE_CALL,
                details = mapOf("targetName" to targetName, "phoneNumber" to phoneNumber)
            )
        } catch (e: Exception) {
            JarvisLogger.e("PhoneController", "Error placing direct call", e)
            openDialer(phoneNumber, targetName)
        }
    }

    /**
     * Opens the standard Android Phone Dialer pre-filled with the number.
     */
    fun openDialer(phoneNumber: String, targetName: String): DeviceActionResult {
        return try {
            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$phoneNumber")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(dialIntent)
            JarvisLogger.i("PhoneController", "Opened dialer for $targetName ($phoneNumber)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ai préparé l'appel vers $targetName sur votre composeur.",
                actionType = DeviceActionType.PHONE_CALL,
                details = mapOf("targetName" to targetName, "phoneNumber" to phoneNumber, "dialerOpened" to true)
            )
        } catch (e: Exception) {
            JarvisLogger.e("PhoneController", "Error opening dialer", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ouvrir le composeur téléphonique : ${e.message}",
                actionType = DeviceActionType.PHONE_CALL,
                error = e.message
            )
        }
    }
}
