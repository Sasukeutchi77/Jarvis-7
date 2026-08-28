package com.openjarvis.android.communication

import android.content.Context
import com.openjarvis.android.communication.contacts.ContactsController
import com.openjarvis.android.communication.context.CommunicationContext
import com.openjarvis.android.communication.messaging.MessagingAppController
import com.openjarvis.android.communication.model.CommunicationActionResult
import com.openjarvis.android.communication.model.CommunicationActionType
import com.openjarvis.android.communication.model.CommunicationConfirmation
import com.openjarvis.android.communication.model.CommunicationResultStatus
import com.openjarvis.android.communication.model.ContactResolutionResult
import com.openjarvis.android.communication.notifications.NotificationController
import com.openjarvis.android.communication.permissions.CommunicationPermissionManager
import com.openjarvis.android.communication.router.CommunicationCommandRouter
import com.openjarvis.android.communication.sms.SmsController
import com.openjarvis.android.core.events.JarvisEvent
import com.openjarvis.android.core.events.JarvisEventBus
import com.openjarvis.android.device.telephony.PhoneController
import com.openjarvis.android.logging.JarvisLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

/**
 * Master Controller for JARVIS Communication Center (Step 5).
 * Orchestrates SMS, Notifications, Contacts, In-line Replies, Conversational Context,
 * and Multi-turn Voice Confirmations.
 */
class JarvisCommunicationController(private val context: Context) {

    val permissionManager = CommunicationPermissionManager(context)
    val contactsController = ContactsController(context)
    val communicationContext = CommunicationContext()
    val messagingAppController = MessagingAppController(context)
    val notificationController = NotificationController(context, messagingAppController, communicationContext)
    val smsController = SmsController(context, contactsController, communicationContext)
    val router = CommunicationCommandRouter()

    // Adapt to PhoneController for calling contacts
    private val deviceContactsAdapter = com.openjarvis.android.device.contacts.ContactsController(context)
    val phoneController = PhoneController(context, deviceContactsAdapter)

    private val _pendingConfirmation = MutableStateFlow<CommunicationConfirmation?>(null)
    val pendingConfirmation: StateFlow<CommunicationConfirmation?> = _pendingConfirmation.asStateFlow()

    private val _lastResult = MutableStateFlow<CommunicationActionResult?>(null)
    val lastResult: StateFlow<CommunicationActionResult?> = _lastResult.asStateFlow()

    /**
     * Inspect and process a natural language query for communication assistance.
     * Returns CommunicationActionResult if handled, or null to delegate to general device/AI engines.
     */
    suspend fun processCommand(userUtterance: String): CommunicationActionResult? = withContext(Dispatchers.Main) {
        val parsed = router.parse(userUtterance)

        // 1. Handle Active Confirmation / Cancellation
        val activeConf = _pendingConfirmation.value
        if (activeConf != null) {
            if (parsed.isConfirmation) {
                JarvisLogger.i("JarvisCommunicationController", "Executing confirmed communication action: ${activeConf.actionType}")
                _pendingConfirmation.value = null
                JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(activeConf.actionType.name, "EXECUTING"))

                val res = activeConf.executeAction()
                recordAndEmit(res)
                return@withContext res
            } else if (parsed.isCancellation) {
                JarvisLogger.i("JarvisCommunicationController", "Cancelled communication action: ${activeConf.actionType}")
                _pendingConfirmation.value = null
                activeConf.onCancel?.invoke()
                val res = CommunicationActionResult(
                    status = CommunicationResultStatus.CANCELLED,
                    spokenMessage = "Action annulée.",
                    actionType = activeConf.actionType
                )
                recordAndEmit(res)
                return@withContext res
            }
        }

        // 2. Handle Message Modification Request (e.g. "change le message en...")
        if (parsed.isModificationRequest || parsed.actionType == CommunicationActionType.MODIFY_SMS_DRAFT) {
            val activeDraft = communicationContext.getPendingSmsDraft()
            if (activeDraft != null) {
                val newBody = if (parsed.secondaryContent.isNotBlank()) parsed.secondaryContent else userUtterance
                val res = smsController.modifyActiveDraft(newBody)
                if (res.status == CommunicationResultStatus.REQUIRES_CONFIRMATION) {
                    val updatedDraft = communicationContext.getPendingSmsDraft()!!
                    _pendingConfirmation.value = CommunicationConfirmation(
                        id = updatedDraft.id,
                        prompt = res.spokenMessage,
                        actionType = CommunicationActionType.SEND_SMS,
                        targetDescription = "${updatedDraft.targetName} : ${updatedDraft.messageBody}",
                        executeAction = {
                            smsController.sendConfirmedSms(updatedDraft)
                        },
                        onCancel = {
                            smsController.cancelActiveDraft()
                        }
                    )
                }
                recordAndEmit(res)
                return@withContext res
            }
        }

        // 3. Handle Homonym Disambiguation Selection (e.g. "le premier", "Paul Martin")
        val pendingHomonyms = communicationContext.getPendingHomonyms()
        if (pendingHomonyms.isNotEmpty() && (parsed.isHomonymSelection || parsed.primaryTarget.isNotBlank())) {
            val selectedContact = contactsController.selectFromHomonyms(userUtterance, pendingHomonyms)
            if (selectedContact != null) {
                communicationContext.clearPendingHomonyms()
                val activeDraft = communicationContext.getPendingSmsDraft()
                val body = activeDraft?.messageBody ?: ""
                val res = smsController.continueComposeWithResolvedContact(selectedContact, body)
                if (res.status == CommunicationResultStatus.REQUIRES_CONFIRMATION) {
                    val draft = communicationContext.getPendingSmsDraft()!!
                    _pendingConfirmation.value = CommunicationConfirmation(
                        id = draft.id,
                        prompt = res.spokenMessage,
                        actionType = CommunicationActionType.SEND_SMS,
                        targetDescription = "${draft.targetName} : ${draft.messageBody}",
                        executeAction = {
                            smsController.sendConfirmedSms(draft)
                        },
                        onCancel = {
                            smsController.cancelActiveDraft()
                        }
                    )
                }
                recordAndEmit(res)
                return@withContext res
            }
        }

        // If unknown communication intent, return null to allow device control or general AI
        if (parsed.actionType == CommunicationActionType.UNKNOWN) {
            return@withContext null
        }

        JarvisLogger.i("JarvisCommunicationController", "Routing communication intent: ${parsed.actionType}")
        JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(parsed.actionType.name, "EXECUTING"))

        val result: CommunicationActionResult = when (parsed.actionType) {
            // Notifications
            CommunicationActionType.READ_NOTIFICATIONS -> {
                notificationController.readActiveNotifications()
            }
            CommunicationActionType.READ_APP_NOTIFICATIONS -> {
                notificationController.readAppNotifications(parsed.appFilter)
            }
            CommunicationActionType.NEXT_NOTIFICATION -> {
                notificationController.readNextNotification()
            }
            CommunicationActionType.SUMMARIZE_NOTIFICATIONS -> {
                notificationController.summarizeNotifications()
            }
            CommunicationActionType.REPLY_TO_NOTIFICATION -> {
                val replyRes = notificationController.prepareNotificationReply(
                    targetSender = parsed.primaryTarget.ifBlank { null },
                    replyContent = parsed.secondaryContent
                )
                if (replyRes.status == CommunicationResultStatus.REQUIRES_CONFIRMATION) {
                    val pendingReply = communicationContext.getPendingNotificationReply()!!
                    _pendingConfirmation.value = CommunicationConfirmation(
                        id = pendingReply.id,
                        prompt = replyRes.spokenMessage,
                        actionType = CommunicationActionType.REPLY_TO_NOTIFICATION,
                        targetDescription = "${pendingReply.targetSender} (${pendingReply.appName}) : ${pendingReply.replyText}",
                        executeAction = {
                            notificationController.executeConfirmedReply(pendingReply)
                        },
                        onCancel = {
                            communicationContext.clearPendingNotificationReply()
                        }
                    )
                }
                replyRes
            }

            // SMS
            CommunicationActionType.READ_SMS -> {
                smsController.readRecentSms(limit = 5, unreadOnly = false, contactFilter = parsed.primaryTarget.ifBlank { null })
            }
            CommunicationActionType.READ_LAST_SMS -> {
                smsController.readLastSms(contactFilter = parsed.primaryTarget.ifBlank { null })
            }
            CommunicationActionType.COMPOSE_SMS -> {
                val composeRes = smsController.composeSms(parsed.primaryTarget, parsed.secondaryContent)
                if (composeRes.status == CommunicationResultStatus.REQUIRES_CONFIRMATION) {
                    val draft = communicationContext.getPendingSmsDraft()!!
                    _pendingConfirmation.value = CommunicationConfirmation(
                        id = draft.id,
                        prompt = composeRes.spokenMessage,
                        actionType = CommunicationActionType.SEND_SMS,
                        targetDescription = "${draft.targetName} : ${draft.messageBody}",
                        executeAction = {
                            smsController.sendConfirmedSms(draft)
                        },
                        onCancel = {
                            smsController.cancelActiveDraft()
                        }
                    )
                }
                composeRes
            }
            CommunicationActionType.CANCEL_SMS -> {
                smsController.cancelActiveDraft()
            }

            // Contacts & Phone Calls
            CommunicationActionType.GET_CONTACT_PHONE -> {
                val resolution = contactsController.resolveContactOrHomonyms(parsed.primaryTarget)
                when (resolution) {
                    is ContactResolutionResult.NotFound -> {
                        CommunicationActionResult(
                            status = CommunicationResultStatus.CONTACT_NOT_FOUND,
                            spokenMessage = "Je n'ai trouvé aucun contact correspondant à « ${parsed.primaryTarget} ».",
                            actionType = CommunicationActionType.GET_CONTACT_PHONE
                        )
                    }
                    is ContactResolutionResult.Homonyms -> {
                        val names = resolution.contacts.take(3).joinToString(", ") { it.displayName }
                        CommunicationActionResult(
                            status = CommunicationResultStatus.AMBIGUOUS_CONTACT,
                            spokenMessage = "J'ai trouvé plusieurs correspondants pour « ${parsed.primaryTarget} » : $names.",
                            actionType = CommunicationActionType.GET_CONTACT_PHONE,
                            details = mapOf("matches" to resolution.contacts)
                        )
                    }
                    is ContactResolutionResult.ExactMatch -> {
                        val c = resolution.contact
                        CommunicationActionResult(
                            status = CommunicationResultStatus.SUCCESS,
                            spokenMessage = "Le numéro de ${c.displayName} est le ${c.phoneNumber}.",
                            actionType = CommunicationActionType.GET_CONTACT_PHONE,
                            details = mapOf("name" to c.displayName, "phone" to c.phoneNumber)
                        )
                    }
                }
            }
            CommunicationActionType.CALL_CONTACT -> {
                val callRes = phoneController.prepareCall(parsed.primaryTarget, directCall = true)
                if (callRes.status == com.openjarvis.android.device.model.ActionResultStatus.REQUIRES_CONFIRMATION) {
                    val targetName = callRes.details["targetName"] as? String ?: parsed.primaryTarget
                    val phoneNumber = callRes.details["phoneNumber"] as? String ?: ""
                    _pendingConfirmation.value = CommunicationConfirmation(
                        id = "call_${System.currentTimeMillis()}",
                        prompt = callRes.spokenMessage,
                        actionType = CommunicationActionType.CALL_CONTACT,
                        targetDescription = "$targetName ($phoneNumber)",
                        executeAction = {
                            val r = phoneController.executeConfirmedCall(phoneNumber, targetName)
                            CommunicationActionResult(
                                status = if (r.isSuccess) CommunicationResultStatus.SUCCESS else CommunicationResultStatus.FAILED,
                                spokenMessage = r.spokenMessage,
                                actionType = CommunicationActionType.CALL_CONTACT,
                                details = r.details
                            )
                        }
                    )
                }
                CommunicationActionResult(
                    status = if (callRes.status == com.openjarvis.android.device.model.ActionResultStatus.REQUIRES_CONFIRMATION) 
                        CommunicationResultStatus.REQUIRES_CONFIRMATION 
                    else if (callRes.isSuccess) CommunicationResultStatus.SUCCESS else CommunicationResultStatus.FAILED,
                    spokenMessage = callRes.spokenMessage,
                    actionType = CommunicationActionType.CALL_CONTACT,
                    details = callRes.details
                )
            }
            CommunicationActionType.CLEAR_CONTEXT -> {
                communicationContext.clear()
                CommunicationActionResult(
                    status = CommunicationResultStatus.SUCCESS,
                    spokenMessage = "Le contexte de communication a été réinitialisé.",
                    actionType = CommunicationActionType.CLEAR_CONTEXT
                )
            }
            else -> {
                CommunicationActionResult(
                    status = CommunicationResultStatus.NOT_SUPPORTED,
                    spokenMessage = "Action de communication non reconnue.",
                    actionType = CommunicationActionType.UNKNOWN
                )
            }
        }

        recordAndEmit(result)
        return@withContext result
    }

    private fun recordAndEmit(result: CommunicationActionResult) {
        _lastResult.value = result
        val eventStatus = if (result.isSuccess) "SUCCESS" else if (result.status == CommunicationResultStatus.REQUIRES_CONFIRMATION) "WAITING_CONFIRMATION" else "ERROR"
        JarvisEventBus.emit(JarvisEvent.ToolExecutionEvent(result.actionType.name, eventStatus, result.spokenMessage))
    }

    fun clearPendingConfirmation() {
        _pendingConfirmation.value = null
    }
}
