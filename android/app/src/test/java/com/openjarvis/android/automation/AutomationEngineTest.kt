package com.openjarvis.android.automation

import com.openjarvis.android.automation.engine.AutomationConditionEngine
import com.openjarvis.android.automation.engine.AutomationValidator
import com.openjarvis.android.automation.model.*
import com.openjarvis.android.automation.storage.AutomationJsonAdapter
import org.junit.Assert.*
import org.junit.Test

class AutomationEngineTest {

    private val validator = AutomationValidator()

    @Test
    fun testAutomationJsonSerializationRoundtrip() {
        val original = Automation(
            id = "test_routine_1",
            name = "Test Routine",
            description = "Description of routine",
            enabled = true,
            priority = 8,
            cooldownSeconds = 60,
            trigger = AutomationTrigger(
                type = TriggerType.TIME_TRIGGER,
                timeOfDay = "07:30",
                repeatPattern = RepeatPattern.WEEKDAYS
            ),
            conditions = listOf(
                AutomationCondition(
                    type = ConditionType.BATTERY_LEVEL,
                    operator = ConditionOperator.GREATER_THAN,
                    expectedNumber = 20.0
                ),
                AutomationCondition(
                    type = ConditionType.IS_CHARGING,
                    operator = ConditionOperator.EQUALS,
                    expectedBoolean = true
                )
            ),
            actions = listOf(
                AutomationAction(
                    type = ActionType.SPEAK,
                    message = "Bonjour Monsieur."
                ),
                AutomationAction(
                    type = ActionType.SHOW_NOTIFICATION,
                    notificationTitle = "JARVIS",
                    notificationBody = "Routine exécutée"
                )
            )
        )

        val triggerJson = AutomationJsonAdapter.triggerToJson(original.trigger)
        val parsedTrigger = AutomationJsonAdapter.triggerFromJson(triggerJson)
        assertEquals(original.trigger.type, parsedTrigger.type)
        assertEquals("07:30", parsedTrigger.timeOfDay)
        assertEquals(RepeatPattern.WEEKDAYS, parsedTrigger.repeatPattern)

        val conditionsJson = AutomationJsonAdapter.conditionsToJson(original.conditions)
        val parsedConditions = AutomationJsonAdapter.conditionsFromJson(conditionsJson)
        assertEquals(2, parsedConditions.size)
        assertEquals(ConditionType.BATTERY_LEVEL, parsedConditions[0].type)
        assertEquals(20.0, parsedConditions[0].expectedNumber ?: 0.0, 0.01)

        val actionsJson = AutomationJsonAdapter.actionsToJson(original.actions)
        val parsedActions = AutomationJsonAdapter.actionsFromJson(actionsJson)
        assertEquals(2, parsedActions.size)
        assertEquals(ActionType.SPEAK, parsedActions[0].type)
        assertEquals("Bonjour Monsieur.", parsedActions[0].message)
    }

    @Test
    fun testAutomationValidation() {
        val validAuto = Automation(
            name = "Valid Routine",
            trigger = AutomationTrigger(type = TriggerType.TIME_TRIGGER, timeOfDay = "12:00"),
            actions = listOf(AutomationAction(type = ActionType.START_BRIEFING))
        )
        val (isValid, err) = validator.validateStructure(validAuto)
        assertTrue(isValid)
        assertNull(err)

        val invalidAuto = Automation(
            name = "",
            trigger = AutomationTrigger(type = TriggerType.TIME_TRIGGER, timeOfDay = null),
            actions = emptyList()
        )
        val (isInvalid, invalidErr) = validator.validateStructure(invalidAuto)
        assertFalse(isInvalid)
        assertNotNull(invalidErr)
    }

    @Test
    fun testRecursionDepthGuard() {
        assertTrue(validator.checkChainDepth(1))
        assertTrue(validator.checkChainDepth(3))
        assertFalse(validator.checkChainDepth(4))
    }

    @Test
    fun testCooldownAndRateLimiter() {
        val auto = Automation(
            id = "rate_test",
            name = "Rate test",
            cooldownSeconds = 5,
            trigger = AutomationTrigger(type = TriggerType.MANUAL_TRIGGER)
        )

        val t0 = 100000L
        validator.recordExecution("rate_test", t0)

        // 2 seconds later -> cooldown active
        assertTrue(validator.isCooldownActive(auto, t0 + 2000L))

        // 6 seconds later -> cooldown expired
        assertFalse(validator.isCooldownActive(auto, t0 + 6000L))
    }

    @Test
    fun testConditionEvaluationLogic() {
        val evalCtx = AutomationConditionEngine.EvaluationContext(
            batteryLevel = 80,
            isCharging = true,
            wifiSsid = "HomeNetwork",
            notificationSender = "Thomas",
            notificationContent = "Bonjour JARVIS"
        )

        // Battery condition: batteryLevel > 50
        val condBattery = AutomationCondition(
            type = ConditionType.BATTERY_LEVEL,
            operator = ConditionOperator.GREATER_THAN,
            expectedNumber = 50.0
        )
        val condCharging = AutomationCondition(
            type = ConditionType.IS_CHARGING,
            operator = ConditionOperator.EQUALS,
            expectedBoolean = true
        )

        val actualBattery = evalCtx.batteryLevel?.toDouble() ?: 0.0
        assertTrue(actualBattery > (condBattery.expectedNumber ?: 0.0))
        assertEquals(true, evalCtx.isCharging)
    }
}
