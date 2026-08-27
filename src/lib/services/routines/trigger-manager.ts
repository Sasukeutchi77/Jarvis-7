/**
 * TRIGGER MANAGER (JARVIS Smart Routines Phase 12)
 * Handles trigger evaluation, event listening, and scheduling criteria.
 */

import { RoutineTrigger, SmartRoutine } from './types.js';

export interface TriggerEvaluationResult {
  matched: boolean;
  triggerType: string;
  triggerId: string;
  routineId: string;
  routineName: string;
  confidence: number;
  reason: string;
}

export class TriggerManager {
  private static instance: TriggerManager;

  private constructor() {}

  public static getInstance(): TriggerManager {
    if (!TriggerManager.instance) {
      TriggerManager.instance = new TriggerManager();
    }
    return TriggerManager.instance;
  }

  /**
   * Evaluates if a voice/text query matches any routine's user action triggers
   */
  public matchVoiceQuery(query: string, routines: SmartRoutine[]): { routine: SmartRoutine; trigger: RoutineTrigger; confidence: number } | null {
    const cleanQuery = query.toLowerCase().trim();

    for (const routine of routines) {
      if (!routine.enabled) continue;

      for (const trigger of routine.triggers) {
        if (!trigger.enabled) continue;

        if (trigger.type === 'user_action' && trigger.userActionConfig?.voicePhrases) {
          for (const phrase of trigger.userActionConfig.voicePhrases) {
            const p = phrase.toLowerCase().trim();
            if (cleanQuery === p || cleanQuery.includes(p)) {
              return { routine, trigger, confidence: 0.95 };
            }
          }
        }

        // Fuzzy match on routine name
        const routineNameLower = routine.name.toLowerCase();
        if (
          cleanQuery.includes(routineNameLower) ||
          (cleanQuery.includes('active') && cleanQuery.includes(routineNameLower.replace('mode ', ''))) ||
          (cleanQuery.includes('lance') && cleanQuery.includes(routineNameLower.replace('mode ', '')))
        ) {
          return { routine, trigger, confidence: 0.9 };
        }
      }
    }

    // Built-in preset natural language fallbacks
    for (const routine of routines) {
      if (!routine.enabled) continue;

      if (routine.presetKey === 'morning') {
        if (
          cleanQuery.includes('mode matin') ||
          cleanQuery.includes('routine matin') ||
          cleanQuery.includes('réveil matin') ||
          cleanQuery === 'bonjour' ||
          cleanQuery === 'bonjour jarvis'
        ) {
          const userTrigger = routine.triggers.find((t) => t.type === 'user_action') || routine.triggers[0];
          return { routine, trigger: userTrigger, confidence: 0.92 };
        }
      }

      if (routine.presetKey === 'work') {
        if (
          cleanQuery.includes('mode travail') ||
          cleanQuery.includes('mode focus') ||
          cleanQuery.includes('routine travail') ||
          cleanQuery.includes('au boulot') ||
          cleanQuery.includes('session de travail')
        ) {
          const userTrigger = routine.triggers.find((t) => t.type === 'user_action') || routine.triggers[0];
          return { routine, trigger: userTrigger, confidence: 0.92 };
        }
      }

      if (routine.presetKey === 'night') {
        if (
          cleanQuery.includes('mode nuit') ||
          cleanQuery.includes('routine soir') ||
          cleanQuery.includes('routine nuit') ||
          cleanQuery.includes('bonne nuit') ||
          cleanQuery.includes('je vais dormir') ||
          cleanQuery.includes('je vais me coucher')
        ) {
          const userTrigger = routine.triggers.find((t) => t.type === 'user_action') || routine.triggers[0];
          return { routine, trigger: userTrigger, confidence: 0.92 };
        }
      }
    }

    return null;
  }

  /**
   * Evaluates time and day triggers against a target time (defaults to now)
   */
  public evaluateTimeTriggers(
    routines: SmartRoutine[],
    targetDate: Date = new Date()
  ): { routine: SmartRoutine; trigger: RoutineTrigger }[] {
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const daysMap: ('sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat')[] = [
      'sun',
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
    ];
    const currentDay = daysMap[targetDate.getDay()];
    const isWeekend = currentDay === 'sat' || currentDay === 'sun';

    const matches: { routine: SmartRoutine; trigger: RoutineTrigger }[] = [];

    for (const routine of routines) {
      if (!routine.enabled) continue;

      for (const trigger of routine.triggers) {
        if (!trigger.enabled || trigger.type !== 'time' || !trigger.timeConfig) continue;

        if (trigger.timeConfig.time === currentTimeStr) {
          // Check day trigger constraint if present in the same routine
          const dayTrigger = routine.triggers.find((t) => t.type === 'day' && t.enabled);
          if (dayTrigger && dayTrigger.dayConfig) {
            const { days, preset } = dayTrigger.dayConfig;
            if (preset === 'weekdays' && isWeekend) continue;
            if (preset === 'weekends' && !isWeekend) continue;
            if (days && days.length > 0 && !days.includes(currentDay)) continue;
          }

          matches.push({ routine, trigger });
        }
      }
    }

    return matches;
  }

  /**
   * Evaluates location trigger (Geofencing enter/exit)
   */
  public evaluateLocationTrigger(
    locationName: string,
    transition: 'enter' | 'exit',
    routines: SmartRoutine[]
  ): { routine: SmartRoutine; trigger: RoutineTrigger }[] {
    const cleanLoc = locationName.toLowerCase().trim();
    const matches: { routine: SmartRoutine; trigger: RoutineTrigger }[] = [];

    for (const routine of routines) {
      if (!routine.enabled) continue;

      for (const trigger of routine.triggers) {
        if (!trigger.enabled || trigger.type !== 'location' || !trigger.locationConfig) continue;

        const trigLoc = trigger.locationConfig.locationName.toLowerCase().trim();
        const trigTrans = trigger.locationConfig.transition;

        if ((cleanLoc.includes(trigLoc) || trigLoc.includes(cleanLoc)) && trigTrans === transition) {
          matches.push({ routine, trigger });
        }
      }
    }

    return matches;
  }

  /**
   * Evaluates notification triggers (incoming push notifications)
   */
  public evaluateNotificationTrigger(
    packageName: string,
    title: string,
    content: string,
    routines: SmartRoutine[]
  ): { routine: SmartRoutine; trigger: RoutineTrigger }[] {
    const fullText = `${title} ${content}`.toLowerCase();
    const matches: { routine: SmartRoutine; trigger: RoutineTrigger }[] = [];

    for (const routine of routines) {
      if (!routine.enabled) continue;

      for (const trigger of routine.triggers) {
        if (!trigger.enabled || trigger.type !== 'notification' || !trigger.notificationConfig) continue;

        const { packageName: reqPkg, keywordFilter } = trigger.notificationConfig;

        if (reqPkg && reqPkg !== packageName) continue;
        if (keywordFilter && !fullText.includes(keywordFilter.toLowerCase())) continue;

        matches.push({ routine, trigger });
      }
    }

    return matches;
  }

  /**
   * Evaluates system event triggers (e.g. alarm dismissed, car bluetooth)
   */
  public evaluateEventTrigger(
    eventType: 'calendar_event_start' | 'alarm_dismissed' | 'battery_level' | 'headset_connected' | 'car_bluetooth_connected',
    eventPayload: Record<string, any>,
    routines: SmartRoutine[]
  ): { routine: SmartRoutine; trigger: RoutineTrigger }[] {
    const matches: { routine: SmartRoutine; trigger: RoutineTrigger }[] = [];

    for (const routine of routines) {
      if (!routine.enabled) continue;

      for (const trigger of routine.triggers) {
        if (!trigger.enabled || trigger.type !== 'event' || !trigger.eventConfig) continue;

        if (trigger.eventConfig.eventType === eventType) {
          matches.push({ routine, trigger });
        }
      }
    }

    return matches;
  }
}

export const triggerManager = TriggerManager.getInstance();
