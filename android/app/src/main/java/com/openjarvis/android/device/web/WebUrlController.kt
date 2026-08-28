package com.openjarvis.android.device.web

import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.openjarvis.android.device.model.ActionResultStatus
import com.openjarvis.android.device.model.DeviceActionResult
import com.openjarvis.android.device.model.DeviceActionType
import com.openjarvis.android.logging.JarvisLogger
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Controller for validating and launching web links, URLs and online searches.
 */
class WebUrlController(private val context: Context) {

    fun openUrl(urlInput: String): DeviceActionResult {
        var cleanUrl = urlInput.trim()
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
            cleanUrl = "https://$cleanUrl"
        }

        return try {
            val uri = Uri.parse(cleanUrl)
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            JarvisLogger.i("WebUrlController", "Opened URL: $cleanUrl")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "J'ouvre le site web.",
                actionType = DeviceActionType.WEB_URL,
                details = mapOf("url" to cleanUrl)
            )
        } catch (e: Exception) {
            JarvisLogger.e("WebUrlController", "Error opening URL: $cleanUrl", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Impossible d'ouvrir l'adresse demandée : ${e.message}",
                actionType = DeviceActionType.WEB_URL,
                error = e.message
            )
        }
    }

    fun searchWeb(query: String): DeviceActionResult {
        val cleanQuery = query
            .replaceFirst(Regex("^(cherche|recherche|google|cherche sur le web|recherche sur internet)\\s+", RegexOption.IGNORE_CASE), "")
            .trim()

        return try {
            val encoded = URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8.toString())
            val uri = Uri.parse("https://www.google.com/search?q=$encoded")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            JarvisLogger.i("WebUrlController", "Performed web search for: $cleanQuery")
            DeviceActionResult(
                status = ActionResultStatus.SUCCESS,
                spokenMessage = "Voici les résultats de recherche pour \"$cleanQuery\".",
                actionType = DeviceActionType.WEB_URL,
                details = mapOf("query" to cleanQuery)
            )
        } catch (e: Exception) {
            JarvisLogger.e("WebUrlController", "Error searching web: $cleanQuery", e)
            DeviceActionResult(
                status = ActionResultStatus.FAILED,
                spokenMessage = "Erreur lors de la recherche : ${e.message}",
                actionType = DeviceActionType.WEB_URL,
                error = e.message
            )
        }
    }
}
