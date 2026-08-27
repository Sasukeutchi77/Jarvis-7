package com.openjarvis.android.core.communication

/**
 * Representation of extensible communication application sources for JARVIS
 */
enum class CommunicationSourceType {
    WHATSAPP,
    SMS,
    TELEGRAM,
    MESSENGER,
    SIGNAL,
    GENERIC,
    OTHER
}

sealed class CommunicationSource(
    val type: CommunicationSourceType,
    val name: String,
    val primaryPackageName: String,
    val knownPackageNames: Set<String>,
    val defaultIconName: String,
    val supportsDirectReply: Boolean
) {
    object WhatsApp : CommunicationSource(
        type = CommunicationSourceType.WHATSAPP,
        name = "WhatsApp",
        primaryPackageName = "com.whatsapp",
        knownPackageNames = setOf("com.whatsapp", "com.whatsapp.w4b"),
        defaultIconName = "MessageCircle",
        supportsDirectReply = true
    )

    object Sms : CommunicationSource(
        type = CommunicationSourceType.SMS,
        name = "SMS & Messagerie",
        primaryPackageName = "com.google.android.apps.messaging",
        knownPackageNames = setOf(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.simplemobiletools.sms.messenger"
        ),
        defaultIconName = "MessageSquare",
        supportsDirectReply = true
    )

    object Telegram : CommunicationSource(
        type = CommunicationSourceType.TELEGRAM,
        name = "Telegram",
        primaryPackageName = "org.telegram.messenger",
        knownPackageNames = setOf(
            "org.telegram.messenger",
            "org.telegram.plus",
            "org.telegram.messenger.web",
            "org.thunderdog.challegram"
        ),
        defaultIconName = "Send",
        supportsDirectReply = true
    )

    object Messenger : CommunicationSource(
        type = CommunicationSourceType.MESSENGER,
        name = "Messenger",
        primaryPackageName = "com.facebook.orca",
        knownPackageNames = setOf("com.facebook.orca", "com.facebook.mlite"),
        defaultIconName = "MessageCircle",
        supportsDirectReply = true
    )

    object Signal : CommunicationSource(
        type = CommunicationSourceType.SIGNAL,
        name = "Signal",
        primaryPackageName = "org.thoughtcrime.securesms",
        knownPackageNames = setOf("org.thoughtcrime.securesms"),
        defaultIconName = "Shield",
        supportsDirectReply = true
    )

    data class Generic(val customPackage: String, val customName: String) : CommunicationSource(
        type = CommunicationSourceType.GENERIC,
        name = customName,
        primaryPackageName = customPackage,
        knownPackageNames = setOf(customPackage),
        defaultIconName = "Bell",
        supportsDirectReply = true
    )

    companion object {
        private val ALL_SOURCES: List<CommunicationSource> = listOf(
            WhatsApp,
            Sms,
            Telegram,
            Messenger,
            Signal
        )

        fun fromPackageName(packageName: String, appLabel: String? = null): CommunicationSource {
            for (source in ALL_SOURCES) {
                if (source.knownPackageNames.contains(packageName)) {
                    return source
                }
            }
            return Generic(packageName, appLabel ?: packageName)
        }

        fun isMessagingApp(packageName: String): Boolean {
            return ALL_SOURCES.any { it.knownPackageNames.contains(packageName) }
        }
    }
}
