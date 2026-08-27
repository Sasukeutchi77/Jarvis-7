/**
 * ACTION MANAGER (JARVIS Core Routine & Action Security Gate)
 * 
 * Manages atomic/composite actions, token-based approval flows for sensitive
 * phone/SMS/system actions, and execution audit trails.
 */

import { IActionManager, ActionExecutionToken } from './types.js';
import { actionManager as routineActionManager } from '../services/routines/action-manager.js';
import { RoutineActionType } from '../services/routines/types.js';

export class ActionManager implements IActionManager {
  private static instance: ActionManager;
  private pendingTokens: Map<string, ActionExecutionToken> = new Map();

  private constructor() {}

  public static getInstance(): ActionManager {
    if (!ActionManager.instance) {
      ActionManager.instance = new ActionManager();
    }
    return ActionManager.instance;
  }

  public async executeAction(
    actionName: string,
    params: Record<string, any>,
    options?: { bypassConfirmation?: boolean }
  ): Promise<{ success: boolean; result?: any; error?: string; tokenRequired?: ActionExecutionToken }> {
    const isSensitive =
      actionName.includes('call') ||
      actionName.includes('sms') ||
      actionName.includes('delete') ||
      actionName.includes('lock') ||
      actionName.includes('reset');

    if (isSensitive && !options?.bypassConfirmation) {
      const token: ActionExecutionToken = {
        token: `act_tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        actionId: `act_${Date.now()}`,
        actionName,
        riskLevel: actionName.includes('reset') || actionName.includes('delete') ? 'critical' : 'high',
        description: `Confirmation requise pour l'action : ${actionName}`,
        payload: params,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      this.pendingTokens.set(token.token, token);
      return {
        success: false,
        tokenRequired: token,
        error: "Action sensible nécessitant une validation explicite de l'utilisateur.",
      };
    }

    try {
      const actionType: RoutineActionType = isSensitive ? 'sensitive_action' : 'voice_briefing';
      const stepLog = await routineActionManager.executeAction(
        'core_session',
        {
          id: `act_${Date.now()}`,
          name: actionName,
          description: `Action JARVIS: ${actionName}`,
          type: actionType,
          order: 1,
          enabled: true,
          isSensitive,
          params,
        }
      );

      const isSuccess = stepLog.status === 'success';
      return {
        success: isSuccess,
        result: stepLog.result,
        error: isSuccess ? undefined : stepLog.result?.message || "Erreur lors de l'exécution.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Erreur lors de l'exécution de l'action.",
      };
    }
  }

  public async confirmSensitiveAction(
    token: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const pending = this.pendingTokens.get(token);
    if (!pending) {
      return { success: false, error: 'Jeton de confirmation expiré ou invalide.' };
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingTokens.delete(token);
      return { success: false, error: 'Ce jeton de confirmation a expiré.' };
    }

    this.pendingTokens.delete(token);
    return this.executeAction(pending.actionName, pending.payload, { bypassConfirmation: true });
  }

  public listPendingConfirmations(): ActionExecutionToken[] {
    return Array.from(this.pendingTokens.values()).filter((t) => Date.now() <= t.expiresAt);
  }
}

export const actionManager = ActionManager.getInstance();
