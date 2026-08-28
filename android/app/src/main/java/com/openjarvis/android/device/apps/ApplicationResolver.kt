package com.openjarvis.android.device.apps

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import java.text.Normalizer
import java.util.Locale

data class ResolvedApp(
    val label: String,
    val packageName: String,
    val isSystemApp: Boolean
)

/**
 * Robust Application Resolver dynamically querying Android PackageManager.
 * Supports exact names, phonetic/diacritic normalization, package IDs, and standard aliases.
 */
class ApplicationResolver(private val context: Context) {

    private val commonAliases = mapOf(
        "whatsapp" to listOf("com.whatsapp", "com.whatsapp.w4b"),
        "youtube" to listOf("com.google.android.youtube"),
        "chrome" to listOf("com.android.chrome", "org.chromium.chrome"),
        "navigateur" to listOf("com.android.chrome", "org.mozilla.firefox"),
        "maps" to listOf("com.google.android.apps.maps"),
        "google maps" to listOf("com.google.android.apps.maps"),
        "spotify" to listOf("com.spotify.music"),
        "musique" to listOf("com.spotify.music", "com.google.android.apps.youtube.music", "com.android.music"),
        "gmail" to listOf("com.google.android.gm"),
        "mail" to listOf("com.google.android.gm", "com.android.email"),
        "email" to listOf("com.google.android.gm", "com.android.email"),
        "courriel" to listOf("com.google.android.gm"),
        "telegram" to listOf("org.telegram.messenger"),
        "photos" to listOf("com.google.android.apps.photos", "com.android.gallery3d", "com.sec.android.gallery3d"),
        "galerie" to listOf("com.google.android.apps.photos", "com.android.gallery3d", "com.sec.android.gallery3d"),
        "appareil photo" to listOf("com.google.android.GoogleCamera", "com.android.camera", "com.sec.android.app.camera"),
        "camera" to listOf("com.google.android.GoogleCamera", "com.android.camera"),
        "caméra" to listOf("com.google.android.GoogleCamera", "com.android.camera"),
        "calculatrice" to listOf("com.google.android.calculator", "com.android.calculator2", "com.sec.android.app.popupcalculator"),
        "horloge" to listOf("com.google.android.deskclock", "com.android.deskclock", "com.sec.android.app.clockpackage"),
        "reveil" to listOf("com.google.android.deskclock", "com.android.deskclock"),
        "réveil" to listOf("com.google.android.deskclock", "com.android.deskclock"),
        "fichiers" to listOf("com.google.android.documentsui", "com.google.android.apps.nbu.files", "com.sec.android.app.myfiles"),
        "downloads" to listOf("com.google.android.documentsui", "com.google.android.apps.nbu.files"),
        "téléchargements" to listOf("com.google.android.documentsui"),
        "contacts" to listOf("com.google.android.contacts", "com.android.contacts", "com.samsung.android.app.contacts"),
        "répertoire" to listOf("com.google.android.contacts", "com.android.contacts"),
        "telephone" to listOf("com.google.android.dialer", "com.android.dialer", "com.samsung.android.dialer"),
        "téléphone" to listOf("com.google.android.dialer", "com.android.dialer", "com.samsung.android.dialer"),
        "messages" to listOf("com.google.android.apps.messaging", "com.android.mms", "com.samsung.android.messaging"),
        "sms" to listOf("com.google.android.apps.messaging", "com.android.mms"),
        "paramètres" to listOf("com.android.settings"),
        "parametres" to listOf("com.android.settings"),
        "settings" to listOf("com.android.settings"),
        "réglages" to listOf("com.android.settings"),
        "play store" to listOf("com.android.vending")
    )

    fun getInstalledLaunchableApps(): List<ResolvedApp> {
        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos: List<ResolveInfo> = pm.queryIntentActivities(mainIntent, 0)
        
        return resolveInfos.mapNotNull { ri ->
            val ai = ri.activityInfo ?: return@mapNotNull null
            val pkg = ai.packageName
            val label = ri.loadLabel(pm)?.toString()?.trim() ?: pkg
            val isSystem = (ai.applicationInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
            ResolvedApp(label = label, packageName = pkg, isSystemApp = isSystem)
        }.distinctBy { it.packageName }
    }

    /**
     * Search an installed app by name, alias or package.
     */
    fun findApp(query: String): List<ResolvedApp> {
        val normalizedQuery = normalizeString(query)
        if (normalizedQuery.isBlank()) return emptyList()

        val allApps = getInstalledLaunchableApps()

        // 1. Direct package name match
        val pkgMatch = allApps.firstOrNull { it.packageName.equals(query.trim(), ignoreCase = true) }
        if (pkgMatch != null) return listOf(pkgMatch)

        // 2. Alias mapping match
        val aliasCandidates = commonAliases[normalizedQuery]
        if (aliasCandidates != null) {
            val matchedFromAlias = allApps.filter { app -> aliasCandidates.any { alias -> app.packageName.equals(alias, ignoreCase = true) } }
            if (matchedFromAlias.isNotEmpty()) {
                return matchedFromAlias
            }
        }

        // 3. Exact normalized label match
        val exactMatches = allApps.filter { normalizeString(it.label) == normalizedQuery }
        if (exactMatches.isNotEmpty()) return exactMatches

        // 4. Starts-with or Substring match
        val prefixMatches = allApps.filter { normalizeString(it.label).startsWith(normalizedQuery) }
        if (prefixMatches.isNotEmpty()) return prefixMatches

        val containsMatches = allApps.filter { 
            normalizeString(it.label).contains(normalizedQuery) || 
            normalizeString(it.packageName).contains(normalizedQuery) 
        }
        return containsMatches
    }

    /**
     * Open application by query string.
     */
    fun launchApp(query: String): DeviceActionResult {
        val cleanedQuery = query
            .replaceFirst(Regex("^(ouvre|lance|démarre|demarre|affiche|start|open)\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(l'application|l'app|l'appli|application|app|appli)\\s+", RegexOption.IGNORE_CASE), "")
            .trim()

        if (cleanedQuery.isBlank()) {
            return DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Veuillez préciser le nom de l'application à ouvrir.",
                actionType = DeviceActionType.OPEN_APP,
                error = "Empty app query"
            )
        }

        val candidates = findApp(cleanedQuery)

        if (candidates.isEmpty()) {
            JarvisLogger.w("ApplicationResolver", "No app found for query: '$cleanedQuery'")
            return DeviceActionResult(
                status = ActionResultStatus.NOT_SUPPORTED,
                spokenMessage = "Je n'ai pas trouvé d'application correspondant à \"$cleanedQuery\" sur cet appareil.",
                actionType = DeviceActionType.OPEN_APP,
                details = mapOf("query" to cleanedQuery),
                error = "App not found"
            )
        }

        if (candidates.size > 1) {
            val names = candidates.take(3).joinToString(", ") { it.label }
            return DeviceActionResult(
                status = ActionResultStatus.REQUIRES_CONFIRMATION,
                spokenMessage = "Plusieurs applications correspondent : $names. Laquelle souhaitez-vous ouvrir ?",
                actionType = DeviceActionType.OPEN_APP,
                details = mapOf("candidates" to candidates.map { it.label })
            )
        }

        val targetApp = candidates.first()
        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(targetApp.packageName)

        if (launchIntent == null) {
            return DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible de lancer l'application ${targetApp.label}.",
                actionType = DeviceActionType.OPEN_APP,
                details = mapOf("package" to targetApp.packageName),
                error = "Launch intent is null"
            )
        }

        return try {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            context.startActivity(launchIntent)
            JarvisLogger.i("ApplicationResolver", "Successfully launched ${targetApp.label} (${targetApp.packageName})")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ouvre ${targetApp.label}.",
                actionType = DeviceActionType.OPEN_APP,
                details = mapOf(
                    "appName" to targetApp.label,
                    "packageName" to targetApp.packageName
                )
            )
        } catch (e: Exception) {
            JarvisLogger.e("ApplicationResolver", "Error starting activity for ${targetApp.packageName}", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Une erreur est survenue lors de l'ouverture de ${targetApp.label}.",
                actionType = DeviceActionType.OPEN_APP,
                error = e.message
            )
        }
    }

    private fun normalizeString(input: String): String {
        val normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
        return normalized.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase(Locale.ROOT)
            .trim()
    }
}
