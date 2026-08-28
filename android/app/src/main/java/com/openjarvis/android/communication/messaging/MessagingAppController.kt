package com.openjarvis.android.communication.messaging

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.openjarvis.android.communication.model.CommunicationSourceType
import com.openjarvis.android.communication.model.MessagingCapability
import com.openjarvis.android.logging.JarvisLogger

/**
 * Controller for detecting and interacting with 3rd-party messaging applications
 * (WhatsApp, Telegram, Signal, Messenger, Google Messages, Gmail, etc.)
 */
class MessagingAppController(private val context: Context) {

    private val packageMap = mapOf(
        "com.whatsapp" to Pair(CommunicationSourceType.WHATSAPP, "WhatsApp"),
        "com.whatsapp.w4b" to Pair(CommunicationSourceType.WHATSAPP, "WhatsApp Business"),
        "org.telegram.messenger" to Pair(CommunicationSourceType.TELEGRAM, "Telegram"),
        "org.telegram.plus" to Pair(CommunicationSourceType.TELEGRAM, "Telegram Plus"),
        "com.facebook.orca" to Pair(CommunicationSourceType.MESSENGER, "Messenger"),
        "org.thoughtcrime.securesms" to Pair(CommunicationSourceType.SIGNAL, "Signal"),
        "com.google.android.apps.messaging" to Pair(CommunicationSourceType.SMS, "Messages Google"),
        "com.google.android.gm" to Pair(CommunicationSourceType.GMAIL, "Gmail"),
        "com.discord" to Pair(CommunicationSourceType.GENERIC, "Discord"),
        "com.Slack" to Pair(CommunicationSourceType.GENERIC, "Slack"),
        "com.viber.voip" to Pair(CommunicationSourceType.GENERIC, "Viber")
    )

    fun isAppInstalled(packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    fun getSourceTypeForPackage(packageName: String): CommunicationSourceType {
        return packageMap[packageName]?.first ?: CommunicationSourceType.OTHER
    }

    fun getAppNameForPackage(packageName: String): String {
        packageMap[packageName]?.let { return it.second }
        return try {
            val appInfo = context.packageManager.getApplicationInfo(packageName, 0)
            context.packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName.substringAfterLast(".")
        }
    }

    fun getCapabilityForPackage(packageName: String, hasRemoteInput: Boolean): MessagingCapability {
        val installed = isAppInstalled(packageName)
        val appName = getAppNameForPackage(packageName)
        return MessagingCapability(
            packageName = packageName,
            appName = appName,
            canRead = true,
            canReply = hasRemoteInput,
            canOpen = installed,
            canMarkRead = false,
            supportsRemoteInput = hasRemoteInput,
            isInstalled = installed
        )
    }

    /**
     * Launch or open a chat in a specific messaging application.
     */
    fun openApp(packageName: String): Boolean {
        return try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launchIntent)
                JarvisLogger.i("MessagingAppController", "Opened application: $packageName")
                true
            } else {
                false
            }
        } catch (e: Exception) {
            JarvisLogger.e("MessagingAppController", "Failed to launch $packageName", e)
            false
        }
    }

    /**
     * Fallback to opening WhatsApp chat for a phone number.
     */
    fun openWhatsAppChat(phoneNumber: String, messageText: String? = null): Boolean {
        return try {
            val cleanNumber = phoneNumber.replace("+", "").replace(" ", "")
            val url = if (!messageText.isNullOrBlank()) {
                "https://api.whatsapp.com/send?phone=$cleanNumber&text=${Uri.encode(messageText)}"
            } else {
                "https://api.whatsapp.com/send?phone=$cleanNumber"
            }
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            JarvisLogger.e("MessagingAppController", "Failed to open WhatsApp URL intent", e)
            false
        }
    }

    /**
     * Returns list of all installed messaging applications.
     */
    fun getInstalledMessagingApps(): List<MessagingCapability> {
        return packageMap.keys.map { pkg ->
            getCapabilityForPackage(pkg, hasRemoteInput = true)
        }.filter { it.isInstalled }
    }
}
