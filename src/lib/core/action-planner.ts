/**
 * ACTION PLANNER (JARVIS Core Intelligence)
 * 
 * Translates AI reasoning and parsed intents into concrete, safe Android and System action steps.
 * Enforces security gating:
 * - READ: Immediate safe execution
 * - SAFE_ACTION: Low-risk state updates
 * - SENSITIVE_ACTION: Gated confirmation tokens & permission verification
 * 
 * Pipeline:
 * AI ENGINE
 *    ↓
 * ACTION PLANNER
 *    ↓
 * ANDROID CONTROL / BRIDGE
 */

import { ParsedIntent, ActionSecurityTier } from './intent-engine.js';
import { ContextSnapshot } from '../services/context/types.js';
import { permissionManager } from './permission-manager.js';
import { androidControlEngine } from './android-control-engine.js';
import { actionManager } from './action-manager.js';
import { ActionExecutionToken } from './types.js';

export interface PlannedActionStep {
  stepId: string;
  name: string;
  description: string;
  securityTier: ActionSecurityTier;
  target: string;
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
  requiredPermission?: string;
  status: 'pending' | 'executing' | 'completed' | 'blocked_permission' | 'blocked_confirmation' | 'failed';
  result?: any;
  error?: string;
}

export interface ActionPlan {
  planId: string;
  intentCategory: string;
  steps: PlannedActionStep[];
  overallSecurityTier: ActionSecurityTier;
  isReadyForExecution: boolean;
  blockedReason?: string;
  confirmationToken?: ActionExecutionToken;
}

export class ActionPlanner {
  private static instance: ActionPlanner;

  private constructor() {}

  public static getInstance(): ActionPlanner {
    if (!ActionPlanner.instance) {
      ActionPlanner.instance = new ActionPlanner();
    }
    return ActionPlanner.instance;
  }

  /**
   * Plans action steps based on user intent and current device context
   */
  public async planActions(
    intent: ParsedIntent,
    context?: ContextSnapshot | Record<string, any>
  ): Promise<ActionPlan> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const steps: PlannedActionStep[] = [];

    switch (intent.category) {
      case 'ANDROID_OPEN_APP': {
        const appName = intent.entities.targetApp || 'Application';
        steps.push({
          stepId: `step_open_${Date.now()}`,
          name: `Lancer ${appName}`,
          description: `Ouvre l'application Android ${appName} via Android Intent Manager`,
          securityTier: 'SAFE_ACTION',
          target: appName,
          parameters: { app: appName },
          requiresConfirmation: false,
          status: 'pending',
        });
        break;
      }

      case 'ANDROID_SYSTEM_CONTROL': {
        const setting = intent.entities.settingName || 'système';
        steps.push({
          stepId: `step_sys_${Date.now()}`,
          name: `Ajuster ${setting}`,
          description: `Modification matérielle Android : ${setting}`,
          securityTier: intent.securityTier,
          target: setting,
          parameters: { setting, value: intent.entities.settingValue },
          requiresConfirmation: false,
          status: 'pending',
        });
        break;
      }

      case 'PHONE_CALL': {
        const contact = intent.entities.contactName || 'Correspondant';
        const isCall = intent.intentName === 'place_phone_call';
        steps.push({
          stepId: `step_phone_${Date.now()}`,
          name: isCall ? `Appel vers ${contact}` : 'Consultation du journal d\'appels',
          description: isCall
            ? `Initialisation d'un appel téléphonique vers ${contact}`
            : 'Lecture sécurisée du journal d\'appels Android',
          securityTier: isCall ? 'SENSITIVE_ACTION' : 'READ',
          target: contact,
          parameters: { contact, isCall },
          requiresConfirmation: isCall,
          requiredPermission: isCall ? 'android.permission.CALL_PHONE' : 'android.permission.READ_CALL_LOG',
          status: 'pending',
        });
        break;
      }

      case 'COMMUNICATION_MESSAGES': {
        const isSend = intent.intentName === 'dispatch_message_reply';
        const contact = intent.entities.contactName || 'Destinataire';
        steps.push({
          stepId: `step_comm_${Date.now()}`,
          name: isSend ? `Envoi de message à ${contact}` : 'Lecture des messages',
          description: isSend
            ? `Envoi d'une réponse via Android RemoteInput à ${contact}`
            : 'Lecture et synthèse vocale des notifications de messagerie',
          securityTier: isSend ? 'SENSITIVE_ACTION' : 'READ',
          target: contact,
          parameters: { contact, isSend },
          requiresConfirmation: isSend,
          requiredPermission: 'notification_listener',
          status: 'pending',
        });
        break;
      }

      default: {
        steps.push({
          stepId: `step_read_${Date.now()}`,
          name: intent.explanation,
          description: `Exécution de la requête ${intent.intentName}`,
          securityTier: intent.securityTier,
          target: intent.targetAgent,
          parameters: { query: intent.entities.rawQuery },
          requiresConfirmation: intent.requiresConfirmation,
          status: 'pending',
        });
        break;
      }
    }

    // Evaluate overall security tier
    let overallTier: ActionSecurityTier = 'READ';
    if (steps.some((s) => s.securityTier === 'SENSITIVE_ACTION')) {
      overallTier = 'SENSITIVE_ACTION';
    } else if (steps.some((s) => s.securityTier === 'SAFE_ACTION')) {
      overallTier = 'SAFE_ACTION';
    }

    return {
      planId,
      intentCategory: intent.category,
      steps,
      overallSecurityTier: overallTier,
      isReadyForExecution: true,
    };
  }

  /**
   * Executes a planned action sequence while strictly validating Android permissions and confirmation tokens
   */
  public async executePlan(
    plan: ActionPlan,
    options?: { bypassConfirmation?: boolean }
  ): Promise<{
    success: boolean;
    executedSteps: PlannedActionStep[];
    spokenSummary: string;
    tokenRequired?: ActionExecutionToken;
    error?: string;
  }> {
    const executedSteps: PlannedActionStep[] = [];

    for (const step of plan.steps) {
      // 1. Permission Verification
      if (step.requiredPermission) {
        const isPermitted = permissionManager.isCapabilityGranted(step.requiredPermission);
        if (!isPermitted) {
          step.status = 'blocked_permission';
          step.error = `Permission Android requise (${step.requiredPermission}) non accordée.`;
          executedSteps.push(step);
          return {
            success: false,
            executedSteps,
            spokenSummary: `La permission Android requise pour cette action n'est pas accordée, Monsieur.`,
            error: step.error,
          };
        }
      }

      // 2. Sensitive Action Security Gating
      if (step.securityTier === 'SENSITIVE_ACTION' && !options?.bypassConfirmation) {
        step.status = 'blocked_confirmation';
        const actionResult = await actionManager.executeAction(step.name, step.parameters);
        if (actionResult.tokenRequired) {
          executedSteps.push(step);
          return {
            success: false,
            executedSteps,
            spokenSummary: `Cette action est sensible. Une validation est requise avant son exécution, Monsieur.`,
            tokenRequired: actionResult.tokenRequired,
            error: actionResult.error,
          };
        }
      }

      // 3. Execution on Android Control Engine
      step.status = 'executing';
      try {
        if (plan.intentCategory === 'ANDROID_OPEN_APP' && step.target) {
          const res = await androidControlEngine.launchApp(step.target);
          step.status = res.success ? 'completed' : 'failed';
          step.result = res;
        } else if (plan.intentCategory === 'ANDROID_SYSTEM_CONTROL' && step.target) {
          const res = await androidControlEngine.toggleHardware(
            step.target as any,
            typeof step.parameters.value === 'boolean' ? step.parameters.value : undefined
          );
          step.status = res.success ? 'completed' : 'failed';
          step.result = res;
        } else {
          step.status = 'completed';
          step.result = { executed: true, timestamp: Date.now() };
        }
      } catch (err: any) {
        step.status = 'failed';
        step.error = err?.message || "Erreur lors de l'exécution Android.";
      }

      executedSteps.push(step);
    }

    const allSucceeded = executedSteps.every((s) => s.status === 'completed');
    return {
      success: allSucceeded,
      executedSteps,
      spokenSummary: allSucceeded
        ? 'Action exécutée avec succès, Monsieur.'
        : "Une difficulté est survenue lors de l'exécution de l'action.",
    };
  }
}

export const actionPlanner = ActionPlanner.getInstance();
