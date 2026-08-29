package com.openjarvis.android.automation.engine

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import com.openjarvis.android.automation.model.AutomationCondition
import com.openjarvis.android.automation.model.ConditionOperator
import com.openjarvis.android.logging.JarvisLogger
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Contextual evaluation engine for automation conditions.
 * Supports relational comparisons and composite logical operations (AND, OR, NOT).
 */
class AutomationConditionEngine(private val context: Context) {

    /**
     * Context payload provided during an event evaluation pass (e.g. notification details, current app).
     */
    data class EvaluationContext(
        val batteryLevel: Int? = null,
        val isCharging: Boolean? = null,
        val notificationPackage: String? = null,
        val notificationSender: String? = null,
        val notificationTitle: String? = null,
        val notificationContent: String? = null,
        val currentAppPackage: String? = null
    )

    /**
     * Evaluates a list of top-level conditions (all must match, equivalent to top-level AND).
     */
    fun evaluateConditions(conditions: List<AutomationCondition>, evalCtx: EvaluationContext = EvaluationContext()): Boolean {
        if (conditions.isEmpty()) return true
        for (condition in conditions) {
            if (!evaluateCondition(condition, evalCtx)) {
                return false
            }
        }
        return true
    }

    /**
     * Evaluates a single condition node (may be composite or leaf).
     */
    fun evaluateCondition(condition: AutomationCondition, evalCtx: EvaluationContext): Boolean {
        return when (condition.operator) {
            ConditionOperator.AND -> {
                if (condition.subConditions.isEmpty()) true
                else condition.subConditions.all { evaluateCondition(it, evalCtx) }
            }
            ConditionOperator.OR -> {
                if (condition.subConditions.isEmpty()) true
                else condition.subConditions.any { evaluateCondition(it, evalCtx) }
            }
            ConditionOperator.NOT -> {
                if (condition.subConditions.isEmpty()) true
                else !condition.subConditions.all { evaluateCondition(it, evalCtx) }
            }
            else -> evaluateLeafCondition(condition, evalCtx)
        }
    }

    private fun evaluateLeafCondition(condition: AutomationCondition, evalCtx: EvaluationContext): Boolean {
        val field = condition.field.lowercase(Locale.ROOT).trim()
        val targetValue = condition.value.trim()

        return try {
            when (field) {
                "battery_level", "battery" -> {
                    val currentBattery = evalCtx.batteryLevel ?: getLiveBatteryLevel()
                    val target = targetValue.toIntOrNull() ?: return false
                    compareNumeric(currentBattery, condition.operator, target)
                }
                "is_charging", "charging" -> {
                    val currentCharging = evalCtx.isCharging ?: isLiveDeviceCharging()
                    val target = targetValue.toBooleanStrictOrNull() ?: (targetValue == "1" || targetValue.equals("oui", true))
                    currentCharging == target
                }
                "time_between", "time_range" -> {
                    isCurrentTimeBetween(targetValue)
                }
                "notification_content", "notification_text" -> {
                    val text = evalCtx.notificationContent ?: ""
                    compareString(text, condition.operator, targetValue)
                }
                "notification_sender", "sender" -> {
                    val sender = evalCtx.notificationSender ?: ""
                    compareString(sender, condition.operator, targetValue)
                }
                "notification_package", "package" -> {
                    val pkg = evalCtx.notificationPackage ?: ""
                    compareString(pkg, condition.operator, targetValue)
                }
                "device_locked" -> {
                    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
                    val isLocked = keyguard?.isKeyguardLocked ?: false
                    val target = targetValue.toBooleanStrictOrNull() ?: true
                    isLocked == target
                }
                "network_connected", "internet" -> {
                    val isOnline = isNetworkConnected()
                    val target = targetValue.toBooleanStrictOrNull() ?: true
                    isOnline == target
                }
                else -> {
                    JarvisLogger.d("ConditionEngine", "Unknown condition field: $field. Defaulting to true.")
                    true
                }
            }
        } catch (e: Exception) {
            JarvisLogger.e("ConditionEngine", "Condition evaluation failed for field [$field]: ${e.message}")
            false
        }
    }

    private fun compareNumeric(actual: Int, op: ConditionOperator, target: Int): Boolean {
        return when (op) {
            ConditionOperator.EQUALS -> actual == target
            ConditionOperator.NOT_EQUALS -> actual != target
            ConditionOperator.GREATER_THAN -> actual > target
            ConditionOperator.LESS_THAN -> actual < target
            else -> actual == target
        }
    }

    private fun compareString(actual: String, op: ConditionOperator, target: String): Boolean {
        return when (op) {
            ConditionOperator.EQUALS -> actual.equals(target, ignoreCase = true)
            ConditionOperator.NOT_EQUALS -> !actual.equals(target, ignoreCase = true)
            ConditionOperator.CONTAINS -> actual.contains(target, ignoreCase = true)
            else -> actual.contains(target, ignoreCase = true)
        }
    }

    /**
     * Evaluates time range formatted as "HH:mm-HH:mm" (e.g. "22:00-07:00").
     */
    private fun isCurrentTimeBetween(timeRangeStr: String): Boolean {
        val parts = timeRangeStr.split("-")
        if (parts.size != 2) return true

        val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
        val nowStr = sdf.format(Date())
        val nowMinutes = parseTimeToMinutes(nowStr)
        val startMinutes = parseTimeToMinutes(parts[0].trim())
        val endMinutes = parseTimeToMinutes(parts[1].trim())

        return if (startMinutes <= endMinutes) {
            nowMinutes in startMinutes..endMinutes
        } else {
            // Over midnight range (e.g. 22:00 to 07:00)
            nowMinutes >= startMinutes || nowMinutes <= endMinutes
        }
    }

    private fun parseTimeToMinutes(timeStr: String): Int {
        val tokens = timeStr.split(":")
        val h = tokens.getOrNull(0)?.toIntOrNull() ?: 0
        val m = tokens.getOrNull(1)?.toIntOrNull() ?: 0
        return (h * 60) + m
    }

    private fun getLiveBatteryLevel(): Int {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) (level * 100) / scale else 50
    }

    private fun isLiveDeviceCharging(): Boolean {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    }

    private fun isNetworkConnected(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNet = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(activeNet) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
