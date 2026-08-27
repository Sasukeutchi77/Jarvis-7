package com.openjarvis.android.logging

import android.util.Log
import java.util.concurrent.ConcurrentLinkedDeque
import java.util.regex.Pattern

/**
 * Secure logging system with automatic PII and secret redaction.
 * Prevents API keys, OAuth tokens, and sensitive personal data from leaking into Logcat or crash reports.
 */
object JarvisLogger {

    private const val TAG = "OpenJarvis"
    private const val MAX_MEMORY_LOGS = 200

    private val memoryLogs = ConcurrentLinkedDeque<LogEntry>()

    data class LogEntry(
        val timestamp: Long,
        val level: String,
        val tag: String,
        val message: String
    )

    // Regex filters for common API keys and tokens
    private val SECRET_PATTERNS = listOf(
        Pattern.compile("sk-[a-zA-Z0-9]{20,}", Pattern.CASE_INSENSITIVE),
        Pattern.compile("AIza[0-9A-Za-z-_]{35}"),
        Pattern.compile("xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}"),
        Pattern.compile("Bearer\\s+[a-zA-Z0-9\\-_\\.]+", Pattern.CASE_INSENSITIVE),
        Pattern.compile("[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+")
    )

    fun d(tag: String = TAG, message: String) {
        val sanitized = sanitize(message)
        Log.d(tag, sanitized)
        record("DEBUG", tag, sanitized)
    }

    fun i(tag: String = TAG, message: String) {
        val sanitized = sanitize(message)
        Log.i(tag, sanitized)
        record("INFO", tag, sanitized)
    }

    fun w(tag: String = TAG, message: String, throwable: Throwable? = null) {
        val sanitized = sanitize(message)
        Log.w(tag, sanitized, throwable)
        record("WARN", tag, sanitized)
    }

    fun e(tag: String = TAG, message: String, throwable: Throwable? = null) {
        val sanitized = sanitize(message)
        Log.e(tag, sanitized, throwable)
        record("ERROR", tag, "$sanitized ${throwable?.message ?: ""}")
    }

    private fun record(level: String, tag: String, message: String) {
        memoryLogs.addLast(LogEntry(System.currentTimeMillis(), level, tag, message))
        while (memoryLogs.size > MAX_MEMORY_LOGS) {
            memoryLogs.pollFirst()
        }
    }

    fun getRecentLogs(): List<LogEntry> = memoryLogs.toList()

    private fun sanitize(raw: String): String {
        var clean = raw
        for (pattern in SECRET_PATTERNS) {
            clean = pattern.matcher(clean).replaceAll("[REDACTED_SECRET]")
        }
        return clean
    }
}
