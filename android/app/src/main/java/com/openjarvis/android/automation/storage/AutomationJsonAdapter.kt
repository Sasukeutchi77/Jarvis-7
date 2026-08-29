package com.openjarvis.android.automation.storage

import org.json.JSONArray
import org.json.JSONObject
import com.openjarvis.android.automation.model.*

/**
 * Lightweight, robust JSON serializer and parser for Automation models.
 * Uses native Android org.json for zero external overhead and maximum speed.
 */
object AutomationJsonAdapter {

    fun triggerToJson(trigger: AutomationTrigger): String {
        val obj = JSONObject()
        obj.put("type", trigger.type.name)
        trigger.timeOfDay?.let { obj.put("timeOfDay", it) }
        trigger.targetTimestamp?.let { obj.put("targetTimestamp", it) }
        trigger.intervalMinutes?.let { obj.put("intervalMinutes", it) }
        val daysArray = JSONArray()
        trigger.daysOfWeek.forEach { daysArray.put(it) }
        obj.put("daysOfWeek", daysArray)
        obj.put("repeatPattern", trigger.repeatPattern.name)
        trigger.batteryThreshold?.let { obj.put("batteryThreshold", it) }
        obj.put("batteryTriggerBelow", trigger.batteryTriggerBelow)
        trigger.isCharging?.let { obj.put("isCharging", it) }
        trigger.notificationPackage?.let { obj.put("notificationPackage", it) }
        trigger.notificationSender?.let { obj.put("notificationSender", it) }
        trigger.notificationKeyword?.let { obj.put("notificationKeyword", it) }
        trigger.appPackageName?.let { obj.put("appPackageName", it) }
        trigger.deviceStateKey?.let { obj.put("deviceStateKey", it) }
        trigger.voicePhrase?.let { obj.put("voicePhrase", it) }
        return obj.toString()
    }

    fun jsonToTrigger(json: String?): AutomationTrigger {
        if (json.isNullOrBlank()) return AutomationTrigger()
        return try {
            val obj = JSONObject(json)
            val daysList = mutableListOf<Int>()
            val daysArray = obj.optJSONArray("daysOfWeek")
            if (daysArray != null) {
                for (i in 0 until daysArray.length()) {
                    daysList.add(daysArray.getInt(i))
                }
            }
            AutomationTrigger(
                type = TriggerType.fromString(obj.optString("type", TriggerType.MANUAL_TRIGGER.name)),
                timeOfDay = obj.optString("timeOfDay").takeIf { it.isNotBlank() },
                targetTimestamp = if (obj.has("targetTimestamp")) obj.optLong("targetTimestamp") else null,
                intervalMinutes = if (obj.has("intervalMinutes")) obj.optLong("intervalMinutes") else null,
                daysOfWeek = daysList,
                repeatPattern = RepeatPattern.fromString(obj.optString("repeatPattern", RepeatPattern.ONCE.name)),
                batteryThreshold = if (obj.has("batteryThreshold")) obj.optInt("batteryThreshold") else null,
                batteryTriggerBelow = obj.optBoolean("batteryTriggerBelow", true),
                isCharging = if (obj.has("isCharging")) obj.optBoolean("isCharging") else null,
                notificationPackage = obj.optString("notificationPackage").takeIf { it.isNotBlank() },
                notificationSender = obj.optString("notificationSender").takeIf { it.isNotBlank() },
                notificationKeyword = obj.optString("notificationKeyword").takeIf { it.isNotBlank() },
                appPackageName = obj.optString("appPackageName").takeIf { it.isNotBlank() },
                deviceStateKey = obj.optString("deviceStateKey").takeIf { it.isNotBlank() },
                voicePhrase = obj.optString("voicePhrase").takeIf { it.isNotBlank() }
            )
        } catch (_: Exception) {
            AutomationTrigger()
        }
    }

    fun conditionsToJson(conditions: List<AutomationCondition>): String {
        val array = JSONArray()
        conditions.forEach { cond ->
            val obj = JSONObject()
            obj.put("id", cond.id)
            obj.put("field", cond.field)
            obj.put("operator", cond.operator.name)
            obj.put("value", cond.value)
            if (cond.subConditions.isNotEmpty()) {
                obj.put("subConditions", JSONArray(conditionsToJson(cond.subConditions)))
            }
            array.put(obj)
        }
        return array.toString()
    }

    fun jsonToConditions(json: String?): List<AutomationCondition> {
        if (json.isNullOrBlank()) return emptyList()
        val list = mutableListOf<AutomationCondition>()
        return try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val subConds = if (obj.has("subConditions")) {
                    jsonToConditions(obj.optJSONArray("subConditions")?.toString())
                } else emptyList()
                list.add(
                    AutomationCondition(
                        id = obj.optString("id"),
                        field = obj.optString("field"),
                        operator = ConditionOperator.fromString(obj.optString("operator", ConditionOperator.EQUALS.name)),
                        value = obj.optString("value"),
                        subConditions = subConds
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun actionsToJson(actions: List<AutomationAction>): String {
        val array = JSONArray()
        actions.forEach { act ->
            val obj = JSONObject()
            obj.put("id", act.id)
            obj.put("type", act.type.name)
            obj.put("isSensitive", act.isSensitive)
            act.message?.let { obj.put("message", it) }
            act.targetApp?.let { obj.put("targetApp", it) }
            act.phoneNumber?.let { obj.put("phoneNumber", it) }
            act.contactName?.let { obj.put("contactName", it) }
            act.command?.let { obj.put("command", it) }
            act.notificationTitle?.let { obj.put("notificationTitle", it) }
            act.notificationBody?.let { obj.put("notificationBody", it) }
            act.intParam?.let { obj.put("intParam", it) }
            act.boolParam?.let { obj.put("boolParam", it) }
            val paramsObj = JSONObject()
            act.parameters.forEach { (k, v) -> paramsObj.put(k, v) }
            obj.put("parameters", paramsObj)
            array.put(obj)
        }
        return array.toString()
    }

    fun jsonToActions(json: String?): List<AutomationAction> {
        if (json.isNullOrBlank()) return emptyList()
        val list = mutableListOf<AutomationAction>()
        return try {
            val array = JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val paramsMap = mutableMapOf<String, String>()
                val paramsObj = obj.optJSONObject("parameters")
                if (paramsObj != null) {
                    val keys = paramsObj.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        paramsMap[key] = paramsObj.getString(key)
                    }
                }
                list.add(
                    AutomationAction(
                        id = obj.optString("id"),
                        type = ActionType.fromString(obj.optString("type", ActionType.SPEAK.name)),
                        isSensitive = obj.optBoolean("isSensitive", false),
                        message = obj.optString("message").takeIf { it.isNotBlank() },
                        targetApp = obj.optString("targetApp").takeIf { it.isNotBlank() },
                        phoneNumber = obj.optString("phoneNumber").takeIf { it.isNotBlank() },
                        contactName = obj.optString("contactName").takeIf { it.isNotBlank() },
                        command = obj.optString("command").takeIf { it.isNotBlank() },
                        notificationTitle = obj.optString("notificationTitle").takeIf { it.isNotBlank() },
                        notificationBody = obj.optString("notificationBody").takeIf { it.isNotBlank() },
                        intParam = if (obj.has("intParam")) obj.optInt("intParam") else null,
                        boolParam = if (obj.has("boolParam")) obj.optBoolean("boolParam") else null,
                        parameters = paramsMap
                    )
                )
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }
}
