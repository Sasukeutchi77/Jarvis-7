/**
 * ROUTINES & AUTOMATION CONTEXT PROVIDER (PHASE 14)
 * 
 * Provides state of active routines, last executed routines, and next scheduled automations.
 */

import { ContextProvider, RoutineContext, ContextSource } from '../types.js';
import { routineEngine, routineScheduler } from '../../routines/index.js';

export class RoutineContextProvider implements ContextProvider<RoutineContext> {
  public readonly source: ContextSource = 'routines';
  public readonly name = 'Routines & Automatisations';
  public readonly description = 'Statut des routines actives, dernière routine déclenchée et prochaines exécutions programmées.';
  private enabled: boolean = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public async fetchContext(): Promise<RoutineContext> {
    const allRoutines = routineEngine.getAllRoutines();

    // Check last executed from history
    const history = routineEngine.getExecutionHistory();
    const lastExec = history[0];

    // Find scheduled time triggers
    let scheduled: { name: string; scheduledTime: string; triggerSummary: string } | undefined;
    for (const routine of allRoutines) {
      if (!routine.enabled) continue;
      const timeTrigger = routine.triggers.find((t) => t.enabled && t.type === 'time' && t.timeConfig?.time);
      if (timeTrigger && timeTrigger.timeConfig) {
        scheduled = {
          name: routine.name,
          scheduledTime: timeTrigger.timeConfig.time,
          triggerSummary: `${timeTrigger.label || 'Horaire quotidien'} (${timeTrigger.timeConfig.time})`,
        };
        break;
      }
    }

    return {
      activeRoutineId: undefined,
      activeRoutineName: undefined,
      lastExecutedRoutine: lastExec
        ? {
            name: lastExec.routineName,
            timestamp: lastExec.startedAt,
            success: lastExec.status === 'success',
          }
        : undefined,
      nextScheduledRoutine: scheduled,
      availableRoutinesCount: allRoutines.length,
    };
  }
}
