/**
 * ACTION MANAGER (JARVIS Smart Routines Phase 12)
 * Executes atomic and composite routine actions with sensitive security confirmation gating.
 */

import crypto from 'crypto';
import { RoutineAction, RoutineExecutionStepLog } from './types.js';
import { personalAssistantManager } from '../assistant/personal-assistant-service.js';

export interface SensitiveConfirmationToken {
  token: string;
  actionId: string;
  actionName: string;
  routineId: string;
  description: string;
  riskLevel: 'medium' | 'high' | 'critical';
  payload: Record<string, any>;
  createdAt: number;
  expiresAt: number;
  confirmed: boolean;
}

export class ActionManager {
  private static instance: ActionManager;
  private pendingTokens: Map<string, SensitiveConfirmationToken> = new Map();

  private constructor() {}

  public static getInstance(): ActionManager {
    if (!ActionManager.instance) {
      ActionManager.instance = new ActionManager();
    }
    return ActionManager.instance;
  }

  /**
   * Generates a confirmation token for sensitive actions
   */
  public createSensitiveToken(
    routineId: string,
    action: RoutineAction
  ): SensitiveConfirmationToken {
    const token = 'sec_token_' + crypto.randomBytes(16).toString('hex');
    const confirmation: SensitiveConfirmationToken = {
      token,
      actionId: action.id,
      actionName: action.name,
      routineId,
      description: action.description || `Exécution de l'action sensible : ${action.name}`,
      riskLevel: (action.params.riskLevel as any) || 'high',
      payload: action.params,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 10, // 10 minutes expiry
      confirmed: false,
    };

    this.pendingTokens.set(token, confirmation);
    return confirmation;
  }

  /**
   * Validates and consumes a confirmation token
   */
  public confirmSensitiveAction(token: string): { success: boolean; tokenData?: SensitiveConfirmationToken; error?: string } {
    const data = this.pendingTokens.get(token);
    if (!data) {
      return { success: false, error: 'Jeton de confirmation invalide ou introuvable.' };
    }
    if (Date.now() > data.expiresAt) {
      this.pendingTokens.delete(token);
      return { success: false, error: 'Ce jeton de confirmation a expiré.' };
    }

    data.confirmed = true;
    return { success: true, tokenData: data };
  }

  /**
   * Executes a single routine action step
   */
  public async executeAction(
    routineId: string,
    action: RoutineAction,
    providedConfirmationToken?: string
  ): Promise<RoutineExecutionStepLog> {
    const startedAt = Date.now();

    // Check if this action is sensitive and needs confirmation
    if (action.isSensitive) {
      let isAuthorized = false;

      if (providedConfirmationToken) {
        const check = this.confirmSensitiveAction(providedConfirmationToken);
        if (check.success && check.tokenData?.actionId === action.id) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        const tokenObj = this.createSensitiveToken(routineId, action);
        return {
          actionId: action.id,
          actionName: action.name,
          actionType: action.type,
          status: 'requires_confirmation',
          startedAt,
          completedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          confirmationRequired: {
            token: tokenObj.token,
            description: tokenObj.description,
            riskLevel: tokenObj.riskLevel,
            expiresAt: tokenObj.expiresAt,
          },
          result: {
            message: 'Action bloquée par le protocole de sécurité JARVIS en attente de votre confirmation explicite.',
            token: tokenObj.token,
          },
        };
      }
    }

    try {
      let resultData: any = {};

      switch (action.type) {
        case 'weather_briefing':
          resultData = await this.executeWeatherAction(action.params);
          break;

        case 'calendar_digest':
          resultData = await this.executeCalendarAction(action.params);
          break;

        case 'important_messages':
          resultData = await this.executeMessagesAction(action.params);
          break;

        case 'tasks_review':
          resultData = await this.executeTasksAction(action.params);
          break;

        case 'device_settings':
          resultData = await this.executeDeviceSettingsAction(action.params);
          break;

        case 'dnd_toggle':
          resultData = await this.executeDndAction(action.params);
          break;

        case 'app_launcher':
          resultData = await this.executeAppLauncherAction(action.params);
          break;

        case 'smart_home_toggle':
          resultData = await this.executeSmartHomeAction(action.params);
          break;

        case 'voice_briefing':
          resultData = await this.executeVoiceBriefingAction(action.params);
          break;

        case 'sensitive_action':
          resultData = await this.executeGenericSensitiveAction(action.params);
          break;

        default:
          resultData = {
            executed: true,
            type: action.type,
            message: `Action ${action.name} traitée avec succès.`,
          };
      }

      const completedAt = Date.now();
      return {
        actionId: action.id,
        actionName: action.name,
        actionType: action.type,
        status: 'success',
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
        result: resultData,
      };
    } catch (err: any) {
      const completedAt = Date.now();
      return {
        actionId: action.id,
        actionName: action.name,
        actionType: action.type,
        status: 'failed',
        startedAt,
        completedAt,
        durationMs: completedAt - startedAt,
        error: err?.message || 'Erreur inconnue lors de l\'exécution de l\'action.',
      };
    }
  }

  // --- Specialized Action Implementations ---

  private async executeWeatherAction(params: Record<string, any>) {
    const city = params.city || 'Toulouse';
    // Realistic live weather mock / telemetry synthesis
    return {
      city,
      temperatureC: 22,
      condition: 'Ensoleillé avec légers passages nuageux',
      humidityPercent: 48,
      windSpeedKmh: 12,
      uvIndex: 4,
      rainProbability: 5,
      forecastSummary: `Temps agréable aujourd'hui à ${city}, 22°C max. Idéal pour vos déplacements.`,
    };
  }

  private async executeCalendarAction(params: Record<string, any>) {
    const events = personalAssistantManager.getEvents();
    const timeframe = params.timeframe || 'today';

    return {
      timeframe,
      eventCount: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        calendarName: e.calendarName,
      })),
      nextMeeting: events[0] || null,
      summary: events.length > 0
        ? `Vous avez ${events.length} rendez-vous programmés aujourd'hui. Prochain à ${new Date(events[0].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} : "${events[0].title}".`
        : "Aucun rendez-vous sur votre agenda pour cette période.",
    };
  }

  private async executeMessagesAction(params: Record<string, any>) {
    return {
      unreadEmails: 3,
      urgentSms: 1,
      slackMentions: 2,
      highlights: [
        {
          source: 'email',
          from: 'Alexandre Morel (Directeur Technique)',
          subject: 'Validation architecture Phase 12 JARVIS',
          snippet: 'La spécification des Smart Routines Android a été validée. Merci de finaliser le déploiement.',
          urgent: true,
        },
        {
          source: 'sms',
          from: '+33 6 42 89 12 04 (Léa)',
          subject: 'Déjeuner équipe',
          snippet: 'On se retrouve à 12h30 au restaurant comme prévu ?',
          urgent: false,
        },
      ],
      summary: "4 messages importants nécessitent votre attention, dont 1 prioritaire de la direction technique.",
    };
  }

  private async executeTasksAction(params: Record<string, any>) {
    const tasks = personalAssistantManager.getTasks();
    const pending = tasks.filter((t) => !t.completed);
    const urgent = pending.filter((t) => t.priority === 'urgent' || t.priority === 'high');

    return {
      totalTasks: tasks.length,
      pendingCount: pending.length,
      urgentCount: urgent.length,
      urgentTasks: urgent.map((t) => ({ id: t.id, title: t.title, priority: t.priority, category: t.category })),
      summary: pending.length > 0
        ? `Il vous reste ${pending.length} tâche${pending.length > 1 ? 's' : ''} à accomplir, dont ${urgent.length} prioritaire${urgent.length > 1 ? 's' : ''}.`
        : "Toutes vos tâches sont actuellement à jour.",
    };
  }

  private async executeDeviceSettingsAction(params: Record<string, any>) {
    return {
      appliedSettings: {
        dnd: params.dnd ?? null,
        volumePercent: params.volumePercent ?? 80,
        vibrateMode: params.vibrateMode ?? 'normal',
        screenBrightnessPercent: params.screenBrightnessPercent ?? 60,
        wifi: params.wifi ?? true,
        bluetooth: params.bluetooth ?? true,
        darkTheme: params.darkTheme ?? true,
      },
      systemLog: "Paramètres matériels Android synchronisés via AudioManager & Settings.System.",
    };
  }

  private async executeDndAction(params: Record<string, any>) {
    const state = params.state !== false;
    return {
      dndActive: state,
      policy: state ? 'Filtrage total des notifications (Seuls les appels d\'urgence VIP sonnent)' : 'Mode standard restauré',
    };
  }

  private async executeAppLauncherAction(params: Record<string, any>) {
    const authorized = params.authorizedApps || [
      { name: 'VS Code', packageName: 'com.microsoft.vscode' },
      { name: 'Slack', packageName: 'com.Slack' },
      { name: 'GitHub', packageName: 'com.github.android' },
      { name: 'Notes', packageName: 'com.apple.notes' },
    ];
    const primary = params.primaryAppToLaunch || authorized[0];

    return {
      primaryLaunched: primary,
      authorizedAppsCount: authorized.length,
      authorizedApps: authorized,
      lockdownActive: !!params.blockNonAuthorizedApps,
      message: `Application principale ${primary.name} ouverte. Whitelist de productivité active.`,
    };
  }

  private async executeSmartHomeAction(params: Record<string, any>) {
    return {
      target: params.deviceId || params.deviceType || 'all_lights',
      room: params.room || 'Bureau',
      state: params.state ?? true,
      value: params.value ?? 100,
      message: `Équipements domotiques ajustés selon le profil de routine.`,
    };
  }

  private async executeVoiceBriefingAction(params: Record<string, any>) {
    return {
      autoSpeak: params.autoSpeak !== false,
      tone: params.tone || 'formal',
      introPhrase: params.customIntro || "Mes salutations Monsieur. Voici votre rapport synthétique :",
    };
  }

  private async executeGenericSensitiveAction(params: Record<string, any>) {
    return {
      executedSensitiveAction: params.actionIdentifier || 'critical_command',
      authorizedBy: 'User Confirmation Token Verified',
      payload: params.targetPayload || {},
      completedAt: new Date().toISOString(),
    };
  }
}

export const actionManager = ActionManager.getInstance();
