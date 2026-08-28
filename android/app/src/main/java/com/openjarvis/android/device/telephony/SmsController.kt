package com.openjarvis.android.device.telephony

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.openjarvis.android.device.contacts.ContactsController
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger

/**
 * Controller for SMS preparation, message composition, and safe confirmed transmission.
 */
class SmsController(
    private val context: Context,
    private val contactsController: ContactsController
) {

    fun hasSmsHardware(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    }

    fun hasSendSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Open default SMS application.
     */
    fun openSmsApp(): DeviceActionResult {
        return try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_DEFAULT)
                type = "vnd.android-dir/mms-sms"
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
            } else {
                val sendIntent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("smsto:")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(sendIntent)
            }
            JarvisLogger.i("SmsController", "Opened default SMS application")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ouvre votre application de messagerie.",
                actionType = DeviceActionType.SMS
            )
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Failed to open SMS app", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ouvrir l'application SMS : ${e.message}",
                actionType = DeviceActionType.SMS,
                error = e.message
            )
        }
    }

    /**
     * Prepare an SMS for a recipient with message content.
     */
    suspend fun prepareSms(recipientQuery: String, messageBody: String, autoSendIfConfirmed: Boolean = true): DeviceActionResult {
        if (!hasSmsHardware()) {
            return DeviceActionResult(
                status = ActionResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne supporte pas l'envoi de SMS.",
                actionType = DeviceActionType.SMS,
                error = "No telephony feature"
            )
        }

        val cleanedRecipient = recipientQuery.trim()
        val isRawNumber = cleanedRecipient.replace(" ", "").replace("-", "").matches(Regex("^\\+?[0-9]{3,15}$"))
        val targetNumber: String
        val targetName: String

        if (isRawNumber) {
            targetNumber = cleanedRecipient.replace(" ", "")
            targetName = targetNumber
        } else {
            val contact = contactsController.findFirstContactMatch(cleanedRecipient)
            if (contact == null) {
                return DeviceActionResult(
                    status = ActionResultStatus.NOT_SUPPORTED,
                    spokenMessage = "Je n'ai pas trouvé le contact \"$cleanedRecipient\" dans votre répertoire.",
                    actionType = DeviceActionType.SMS,
                    error = "Contact not found"
                )
            }
            targetNumber = contact.phoneNumber
            targetName = contact.displayName
        }

        if (autoSendIfConfirmed && hasSendSmsPermission()) {
            return DeviceActionResult(
                status = ActionResultStatus.REQUIRES_CONFIRMATION,
                spokenMessage = "Je vais envoyer le SMS suivant à $targetName : \"$messageBody\". Confirmer ?",
                actionType = DeviceActionType.SMS,
                details = mapOf(
                    "recipientName" to targetName,
                    "phoneNumber" to targetNumber,
                    "messageBody" to messageBody
                )
            )
        } else {
            // Open pre-filled SMS app composer safely
            return openSmsComposer(targetNumber, targetName, messageBody)
        }
    }

    /**
     * Open system SMS Composer pre-filled.
     */
    fun openSmsComposer(phoneNumber: String, recipientName: String, messageBody: String): DeviceActionResult {
        return try {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("smsto:$phoneNumber")
                putExtra("sms_body", messageBody)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            JarvisLogger.i("SmsController", "Opened SMS composer for $recipientName ($phoneNumber)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ai préparé votre SMS pour $recipientName dans votre application de messagerie.",
                actionType = DeviceActionType.SMS,
                details = mapOf("recipient" to recipientName, "phoneNumber" to phoneNumber, "body" to messageBody)
            )
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Error opening SMS composer", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Erreur lors de la préparation du SMS : ${e.message}",
                actionType = DeviceActionType.SMS,
                error = e.message
            )
        }
    }

    /**
     * Send SMS directly after explicit user confirmation.
     */
    fun sendConfirmedSms(phoneNumber: String, recipientName: String, messageBody: String): DeviceActionResult {
        if (!hasSendSmsPermission()) {
            return openSmsComposer(phoneNumber, recipientName, messageBody)
        }

        return try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(messageBody)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(phoneNumber, null, messageBody, null, null)
            }

            JarvisLogger.i("SmsController", "Successfully sent SMS to $recipientName ($phoneNumber)")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Le SMS a été envoyé avec succès à $recipientName.",
                actionType = DeviceActionType.SMS,
                details = mapOf("recipient" to recipientName, "phoneNumber" to phoneNumber)
            )
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Failed to transmit direct SMS", e)
            openSmsComposer(phoneNumber, recipientName, messageBody)
        }
    }
}
