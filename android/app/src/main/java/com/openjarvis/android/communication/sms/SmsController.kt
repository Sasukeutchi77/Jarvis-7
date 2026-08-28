package com.openjarvis.android.communication.sms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.openjarvis.android.communication.contacts.ContactsController
import com.openjarvis.android.communication.context.CommunicationContext
import com.openjarvis.android.communication.model.CommunicationActionResult
import com.openjarvis.android.communication.model.CommunicationActionType
import com.openjarvis.android.communication.model.CommunicationResultStatus
import com.openjarvis.android.communication.model.ContactRecord
import com.openjarvis.android.communication.model.ContactResolutionResult
import com.openjarvis.android.communication.model.PendingSmsDraft
import com.openjarvis.android.communication.model.SmsRecord
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * High-reliability SMS Controller for OpenJarvis.
 * Implements SMS reading (inbox query), smart contact resolution, draft composition,
 * in-flight message modification, user voice confirmation, and confirmed transmission.
 */
class SmsController(
    private val context: Context,
    private val contactsController: ContactsController,
    private val communicationContext: CommunicationContext
) {

    fun hasTelephonyHardware(): Boolean {
        return context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    }

    fun hasReadSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    fun hasSendSmsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Read recent SMS messages from Android Telephony inbox.
     */
    suspend fun readRecentSms(
        limit: Int = 5,
        unreadOnly: Boolean = false,
        contactFilter: String? = null
    ): CommunicationActionResult = withContext(Dispatchers.IO) {
        if (!hasTelephonyHardware()) {
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne dispose pas de fonctionnalité de téléphonie SMS.",
                actionType = CommunicationActionType.READ_SMS,
                error = "Telephony feature unavailable"
            )
        }

        if (!hasReadSmsPermission()) {
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.PERMISSION_REQUIRED,
                spokenMessage = "J'ai besoin de l'autorisation d'accès aux SMS pour pouvoir les lire. Voulez-vous ouvrir les paramètres ?",
                actionType = CommunicationActionType.READ_SMS,
                permissionNeeded = Manifest.permission.READ_SMS
            )
        }

        val messages = queryInbox(limit = 20)
        if (messages.isEmpty()) {
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = "Vous n'avez aucun message récent dans votre boîte de réception SMS.",
                actionType = CommunicationActionType.READ_SMS
            )
        }

        // Apply filters
        var filtered = messages
        if (unreadOnly) {
            filtered = filtered.filter { !it.isRead }
        }

        if (!contactFilter.isNullOrBlank()) {
            val normFilter = contactsController.normalize(contactFilter)
            filtered = filtered.filter { sms ->
                val normName = sms.contactName?.let { contactsController.normalize(it) } ?: ""
                normName.contains(normFilter) || sms.address.contains(normFilter)
            }
        }

        val targetList = filtered.take(limit)

        if (targetList.isEmpty()) {
            val msg = if (!contactFilter.isNullOrBlank()) {
                "Vous n'avez aucun SMS récent de \"$contactFilter\"."
            } else if (unreadOnly) {
                "Vous n'avez aucun SMS non lu."
            } else {
                "Aucun SMS trouvé correspondant à votre demande."
            }
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.NO_DATA,
                spokenMessage = msg,
                actionType = CommunicationActionType.READ_SMS
            )
        }

        // Save into context for follow-up navigation
        communicationContext.setSmsList(targetList)

        // Build spoken response
        val response = if (targetList.size == 1) {
            val single = targetList.first()
            val sender = single.contactName ?: single.address
            val timeStr = formatRelativeTime(single.timestamp)
            "Vous avez un SMS de $sender ($timeStr) : « ${single.body} »"
        } else {
            val count = targetList.size
            val senderList = targetList.map { it.contactName ?: it.address }.distinct().joinToString(", ")
            val first = targetList.first()
            val firstSender = first.contactName ?: first.address
            "Vous avez $count messages récents, venant de $senderList. Le plus récent est de $firstSender : « ${first.body} »"
        }

        return@withContext CommunicationActionResult(
            status = CommunicationResultStatus.SUCCESS,
            spokenMessage = response,
            actionType = CommunicationActionType.READ_SMS,
            details = mapOf(
                "count" to targetList.size,
                "firstSender" to (targetList.first().contactName ?: targetList.first().address),
                "messages" to targetList
            )
        )
    }

    /**
     * Read the single latest SMS.
     */
    suspend fun readLastSms(contactFilter: String? = null): CommunicationActionResult {
        return readRecentSms(limit = 1, unreadOnly = false, contactFilter = contactFilter)
    }

    /**
     * Compose an SMS draft for recipient and message body.
     */
    suspend fun composeSms(recipientQuery: String, messageBody: String): CommunicationActionResult = withContext(Dispatchers.Main) {
        if (!hasTelephonyHardware()) {
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.NOT_SUPPORTED,
                spokenMessage = "Cet appareil ne permet pas l'envoi de SMS.",
                actionType = CommunicationActionType.COMPOSE_SMS,
                error = "Telephony feature unavailable"
            )
        }

        val cleanedRecipient = recipientQuery.trim()
        if (cleanedRecipient.isBlank()) {
            return@withContext CommunicationActionResult(
                status = CommunicationResultStatus.FAILED,
                spokenMessage = "À qui souhaitez-vous envoyer ce SMS ?",
                actionType = CommunicationActionType.COMPOSE_SMS,
                error = "Recipient empty"
            )
        }

        // 1. Resolve contact or homonyms
        val resolution = contactsController.resolveContactOrHomonyms(cleanedRecipient)
        when (resolution) {
            is ContactResolutionResult.NotFound -> {
                return@withContext CommunicationActionResult(
                    status = CommunicationResultStatus.CONTACT_NOT_FOUND,
                    spokenMessage = "Je ne trouve aucun contact correspondant à « $cleanedRecipient » dans votre répertoire.",
                    actionType = CommunicationActionType.COMPOSE_SMS,
                    error = "Contact not found"
                )
            }
            is ContactResolutionResult.Homonyms -> {
                communicationContext.setPendingHomonyms(cleanedRecipient, resolution.contacts)
                val names = resolution.contacts.take(4).mapIndexed { idx, c -> "${idx + 1}. ${c.displayName}" }.joinToString(", ")
                return@withContext CommunicationActionResult(
                    status = CommunicationResultStatus.REQUIRES_HOMONYM_CHOICE,
                    spokenMessage = "J'ai trouvé plusieurs contacts nommés « $cleanedRecipient » : $names. Lequel voulez-vous ?",
                    actionType = CommunicationActionType.RESOLVE_HOMONYM,
                    details = mapOf("homonyms" to resolution.contacts, "query" to cleanedRecipient, "body" to messageBody)
                )
            }
            is ContactResolutionResult.ExactMatch -> {
                val contact = resolution.contact
                return@withContext buildDraftAndRequestConfirmation(contact, messageBody)
            }
        }
    }

    /**
     * Continue composition once homonym choice is resolved.
     */
    suspend fun continueComposeWithResolvedContact(contact: ContactRecord, messageBody: String): CommunicationActionResult {
        return buildDraftAndRequestConfirmation(contact, messageBody)
    }

    private fun buildDraftAndRequestConfirmation(contact: ContactRecord, messageBody: String): CommunicationActionResult {
        val draft = PendingSmsDraft(
            id = "draft_${System.currentTimeMillis()}",
            recipientQuery = contact.displayName,
            targetName = contact.displayName,
            phoneNumber = contact.phoneNumber,
            messageBody = messageBody
        )
        communicationContext.setPendingSmsDraft(draft)

        val spoken = "Je vais envoyer le SMS suivant à ${contact.displayName} : « $messageBody ». Confirmer ?"
        return CommunicationActionResult(
            status = CommunicationResultStatus.REQUIRES_CONFIRMATION,
            spokenMessage = spoken,
            actionType = CommunicationActionType.COMPOSE_SMS,
            details = mapOf(
                "draftId" to draft.id,
                "recipient" to contact.displayName,
                "phoneNumber" to contact.phoneNumber,
                "body" to messageBody
            )
        )
    }

    /**
     * Modify the message body of the active draft before sending.
     */
    fun modifyActiveDraft(newBody: String): CommunicationActionResult {
        val activeDraft = communicationContext.getPendingSmsDraft()
        if (activeDraft == null) {
            return CommunicationActionResult(
                status = CommunicationResultStatus.FAILED,
                spokenMessage = "Il n'y a aucun message en cours de préparation.",
                actionType = CommunicationActionType.MODIFY_SMS_DRAFT,
                error = "No active draft"
            )
        }

        val updatedDraft = activeDraft.copy(messageBody = newBody, isAwaitingModification = false)
        communicationContext.setPendingSmsDraft(updatedDraft)

        val spoken = "Message mis à jour. Je vais envoyer à ${updatedDraft.targetName} : « $newBody ». Confirmer ?"
        return CommunicationActionResult(
            status = CommunicationResultStatus.REQUIRES_CONFIRMATION,
            spokenMessage = spoken,
            actionType = CommunicationActionType.MODIFY_SMS_DRAFT,
            details = mapOf(
                "draftId" to updatedDraft.id,
                "recipient" to updatedDraft.targetName,
                "phoneNumber" to updatedDraft.phoneNumber,
                "body" to newBody
            )
        )
    }

    /**
     * Cancel active SMS draft.
     */
    fun cancelActiveDraft(): CommunicationActionResult {
        val draft = communicationContext.getPendingSmsDraft()
        communicationContext.clearPendingSmsDraft()
        val spoken = if (draft != null) "Envoi du SMS vers ${draft.targetName} annulé." else "Action annulée."
        return CommunicationActionResult(
            status = CommunicationResultStatus.CANCELLED,
            spokenMessage = spoken,
            actionType = CommunicationActionType.CANCEL_SMS
        )
    }

    /**
     * Execute confirmed direct SMS transmission.
     */
    fun sendConfirmedSms(draft: PendingSmsDraft): CommunicationActionResult {
        if (!hasSendSmsPermission()) {
            JarvisLogger.w("SmsController", "SEND_SMS permission missing, opening SMS composer as fallback")
            return openSmsComposer(draft.phoneNumber, draft.targetName, draft.messageBody)
        }

        return try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(draft.messageBody)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(draft.phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(draft.phoneNumber, null, draft.messageBody, null, null)
            }

            communicationContext.clearPendingSmsDraft()
            JarvisLogger.i("SmsController", "Successfully sent confirmed SMS to ${draft.targetName} (${draft.phoneNumber})")

            CommunicationActionResult(
                status = CommunicationResultStatus.SUCCESS,
                spokenMessage = "Le SMS a été envoyé avec succès à ${draft.targetName}.",
                actionType = CommunicationActionType.SEND_SMS,
                details = mapOf(
                    "recipient" to draft.targetName,
                    "phoneNumber" to draft.phoneNumber,
                    "body" to draft.messageBody
                )
            )
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Failed to transmit confirmed SMS", e)
            openSmsComposer(draft.phoneNumber, draft.targetName, draft.messageBody)
        }
    }

    /**
     * Open standard SMS Composer intent pre-filled with recipient and body.
     */
    fun openSmsComposer(phoneNumber: String, recipientName: String, messageBody: String): CommunicationActionResult {
        return try {
            val intent = Intent(Intent.ACTION_SENDTO).apply {
                data = Uri.parse("smsto:$phoneNumber")
                putExtra("sms_body", messageBody)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            communicationContext.clearPendingSmsDraft()
            CommunicationActionResult(
                status = CommunicationResultStatus.SUCCESS,
                spokenMessage = "J'ai préparé votre SMS pour $recipientName dans votre application de messagerie.",
                actionType = CommunicationActionType.SEND_SMS,
                details = mapOf("recipient" to recipientName, "phoneNumber" to phoneNumber, "body" to messageBody)
            )
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Failed to open SMS composer", e)
            CommunicationActionResult(
                status = CommunicationResultStatus.SEND_FAILED,
                spokenMessage = "Impossible d'envoyer le message : ${e.message}",
                actionType = CommunicationActionType.SEND_SMS,
                error = e.message
            )
        }
    }

    private suspend fun queryInbox(limit: Int): List<SmsRecord> = withContext(Dispatchers.IO) {
        val results = mutableListOf<SmsRecord>()
        var cursor: Cursor? = null
        try {
            val uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.THREAD_ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.READ
            )

            cursor = context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} DESC LIMIT $limit"
            )

            cursor?.let {
                val idIdx = it.getColumnIndex(Telephony.Sms._ID)
                val threadIdx = it.getColumnIndex(Telephony.Sms.THREAD_ID)
                val addrIdx = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = it.getColumnIndex(Telephony.Sms.DATE)
                val readIdx = it.getColumnIndex(Telephony.Sms.READ)

                while (it.moveToNext()) {
                    val id = if (idIdx >= 0) it.getString(idIdx) ?: "" else ""
                    val threadId = if (threadIdx >= 0) it.getString(threadIdx) ?: "" else ""
                    val address = if (addrIdx >= 0) it.getString(addrIdx) ?: "" else ""
                    val body = if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else ""
                    val date = if (dateIdx >= 0) it.getLong(dateIdx) else 0L
                    val isRead = if (readIdx >= 0) it.getInt(readIdx) == 1 else true

                    if (body.isNotBlank() && address.isNotBlank()) {
                        // Resolve contact name for address
                        val contact = contactsController.findFirstContactMatch(address)
                        results.add(
                            SmsRecord(
                                id = id,
                                threadId = threadId,
                                address = address,
                                contactName = contact?.displayName,
                                body = body,
                                timestamp = date,
                                isRead = isRead,
                                isIncoming = true
                            )
                        )
                    }
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("SmsController", "Error querying Telephony SMS inbox", e)
        } finally {
            cursor?.close()
        }

        return@withContext results
    }

    private suspend fun ContactsController.findFirstContactMatch(query: String): ContactRecord? {
        val matches = this.searchContacts(query)
        return matches.firstOrNull()
    }

    private fun formatRelativeTime(timestamp: Long): String {
        if (timestamp <= 0) return "récemment"
        val diff = System.currentTimeMillis() - timestamp
        val minutes = diff / (1000 * 60)
        val hours = diff / (1000 * 60 * 60)

        return when {
            minutes < 2 -> "à l'instant"
            minutes < 60 -> "il y a $minutes minutes"
            hours < 24 -> "il y a $hours heures"
            else -> {
                val sdf = SimpleDateFormat("dd/MM à HH:mm", Locale.FRENCH)
                sdf.format(Date(timestamp))
            }
        }
    }
}
