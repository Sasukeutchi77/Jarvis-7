/**
 * ROUTINE ENGINE (JARVIS Smart Routines Phase 12)
 * Core orchestrator for customizable routines, execution lifecycles, and spoken briefings.
 */

import {
  SmartRoutine,
  RoutineExecutionReport,
  RoutineExecutionStepLog,
  RoutineTrigger,
  RoutineAction,
} from './types.js';
import { triggerManager } from './trigger-manager.js';
import { actionManager } from './action-manager.js';
import { routineScheduler } from './routine-scheduler.js';

export class RoutineEngine {
  private static instance: RoutineEngine;
  private routines: Map<string, SmartRoutine> = new Map();
  private executionHistory: RoutineExecutionReport[] = [];

  private constructor() {
    this.seedDefaultRoutines();
    this.syncScheduler();
  }

  public static getInstance(): RoutineEngine {
    if (!RoutineEngine.instance) {
      RoutineEngine.instance = new RoutineEngine();
    }
    return RoutineEngine.instance;
  }

  /**
   * Seeds the 3 required built-in presets: MODE MATIN, MODE TRAVAIL, MODE NUIT
   */
  private seedDefaultRoutines() {
    const now = Date.now();

    // 1. MODE MATIN
    const morningRoutine: SmartRoutine = {
      id: 'routine_morning_preset',
      name: 'Mode Matin',
      presetKey: 'morning',
      description: 'Briefing matinal complet : météo en direct, calendrier du jour, messages importants, tâches prioritaires et synthèse vocale.',
      icon: 'Sun',
      color: '#f59e0b',
      enabled: true,
      isBuiltin: true,
      triggers: [
        {
          id: 'trig_m_1',
          type: 'time',
          label: 'Tous les matins à 07:00',
          enabled: true,
          timeConfig: { time: '07:00', exactAlarm: true },
        },
        {
          id: 'trig_m_2',
          type: 'day',
          label: 'Lundi au Vendredi (Jours ouvrés)',
          enabled: true,
          dayConfig: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], preset: 'weekdays' },
        },
        {
          id: 'trig_m_3',
          type: 'user_action',
          label: 'Commande Vocale / UI',
          enabled: true,
          userActionConfig: {
            voicePhrases: ['lance le mode matin', 'active la routine du matin', 'bonjour jarvis', 'mode matin'],
            shortcutName: 'Mode Matin',
          },
        },
      ],
      actions: [
        {
          id: 'act_m_weather',
          type: 'weather_briefing',
          name: 'Bulletin Météo & Prévisions',
          description: 'Récupération des conditions atmosphériques et températures locales.',
          order: 1,
          enabled: true,
          isSensitive: false,
          params: { city: 'Toulouse', includeHourly: true },
        },
        {
          id: 'act_m_calendar',
          type: 'calendar_digest',
          name: 'Calendrier & Rendez-vous du Jour',
          description: 'Consultation des réunions et rendez-vous prévus aujourd\'hui.',
          order: 2,
          enabled: true,
          isSensitive: false,
          params: { timeframe: 'today', maxEvents: 5 },
        },
        {
          id: 'act_m_messages',
          type: 'important_messages',
          name: 'Messages Importants & Tri des Urgences',
          description: 'Filtrage des emails prioritaires, SMS et mentions d\'équipe non lus.',
          order: 3,
          enabled: true,
          isSensitive: false,
          params: { sources: ['email', 'sms', 'chat'], unreadOnly: true, urgentOnly: true },
        },
        {
          id: 'act_m_tasks',
          type: 'tasks_review',
          name: 'Revue des Tâches Prioritaires',
          description: 'Affichage des tâches urgentes à accomplir dans la journée.',
          order: 4,
          enabled: true,
          isSensitive: false,
          params: { scope: 'today_pending', categoryFilter: 'all' },
        },
        {
          id: 'act_m_voice',
          type: 'voice_briefing',
          name: 'Briefing Vocal Synthétique JARVIS',
          description: 'Élocution du rapport matinal complet avec le flegme britannique caractéristique.',
          order: 5,
          enabled: true,
          isSensitive: false,
          params: { tone: 'formal', autoSpeak: true, customIntro: 'Mes salutations, Monsieur. Voici votre rapport matinal complet :' },
        },
      ],
      executionPolicy: {
        stopOnError: false,
        parallelExecutionAllowed: true,
        requireBiometricConfirmationForSensitive: false,
        wakeScreenOnRun: true,
        keepForegroundNotification: false,
      },
      stats: {
        runCount: 28,
        lastRunAt: now - 1000 * 3600 * 22,
        lastRunStatus: 'success',
        lastDurationMs: 1420,
      },
      createdAt: now - 1000 * 3600 * 24 * 14,
      updatedAt: now,
    };

    // 2. MODE TRAVAIL
    const workRoutine: SmartRoutine = {
      id: 'routine_work_preset',
      name: 'Mode Travail',
      presetKey: 'work',
      description: 'Configuration hyperfocus : filtrage des notifications (DND), calendrier professionnel, whitelist des applications de travail et paramètres système adaptés.',
      icon: 'Briefcase',
      color: '#6366f1',
      enabled: true,
      isBuiltin: true,
      triggers: [
        {
          id: 'trig_w_1',
          type: 'time',
          label: 'Début de journée à 09:00',
          enabled: true,
          timeConfig: { time: '09:00', exactAlarm: false },
        },
        {
          id: 'trig_w_2',
          type: 'location',
          label: 'Arrivée au Bureau (Geofence)',
          enabled: true,
          locationConfig: { locationName: 'Bureau', transition: 'enter', radiusMeters: 100 },
        },
        {
          id: 'trig_w_3',
          type: 'user_action',
          label: 'Commande Vocale / UI',
          enabled: true,
          userActionConfig: {
            voicePhrases: ['active le mode travail', 'mode travail', 'mode focus', 'je me mets au travail', 'session de dev'],
            shortcutName: 'Mode Travail',
          },
        },
      ],
      actions: [
        {
          id: 'act_w_dnd',
          type: 'dnd_toggle',
          name: 'Filtrage Notifications (Mode Ne Pas Déranger)',
          description: 'Silence des alertes secondaires avec maintien exclusif des contacts VIP.',
          order: 1,
          enabled: true,
          isSensitive: false,
          params: { state: true },
        },
        {
          id: 'act_w_calendar',
          type: 'calendar_digest',
          name: 'Calendrier & Deadlines de Travail',
          description: 'Focus sur les réunions professionnelles et jalons du jour.',
          order: 2,
          enabled: true,
          isSensitive: false,
          params: { timeframe: 'today', calendarFilter: ['Professionnel', 'Développement'] },
        },
        {
          id: 'act_w_apps',
          type: 'app_launcher',
          name: 'Applications Autorisées & Lancement Outils',
          description: 'Ouverture de l\'environnement de code et restriction des distractions.',
          order: 3,
          enabled: true,
          isSensitive: false,
          params: {
            authorizedApps: [
              { name: 'VS Code', packageName: 'com.microsoft.vscode' },
              { name: 'Slack', packageName: 'com.Slack' },
              { name: 'GitHub', packageName: 'com.github.android' },
              { name: 'Notes', packageName: 'com.apple.notes' },
            ],
            primaryAppToLaunch: { name: 'VS Code', packageName: 'com.microsoft.vscode' },
            blockNonAuthorizedApps: false,
          },
        },
        {
          id: 'act_w_settings',
          type: 'device_settings',
          name: 'Paramètres Configurables Système Android',
          description: 'Vibreur actif, volume média ajusté à 40%, Wi-Fi haute performance.',
          order: 4,
          enabled: true,
          isSensitive: false,
          params: { vibrateMode: 'vibrate', volumePercent: 40, screenBrightnessPercent: 85, wifi: true },
        },
        {
          id: 'act_w_voice',
          type: 'voice_briefing',
          name: 'Annonce Vocale de Mise au Travail',
          description: 'Confirmation de l\'environnement prêt et rappel des priorités.',
          order: 5,
          enabled: true,
          isSensitive: false,
          params: { tone: 'concise', customIntro: 'Mode Travail & Hyperfocus enclenché, Monsieur. Distractions neutralisées.' },
        },
      ],
      executionPolicy: {
        stopOnError: false,
        parallelExecutionAllowed: true,
        requireBiometricConfirmationForSensitive: false,
        wakeScreenOnRun: true,
        keepForegroundNotification: true,
      },
      stats: {
        runCount: 42,
        lastRunAt: now - 1000 * 3600 * 5,
        lastRunStatus: 'success',
        lastDurationMs: 1180,
      },
      createdAt: now - 1000 * 3600 * 24 * 14,
      updatedAt: now,
    };

    // 3. MODE NUIT
    const nightRoutine: SmartRoutine = {
      id: 'routine_night_preset',
      name: 'Mode Nuit',
      presetKey: 'night',
      description: 'Clôture de journée et préparation du sommeil : résumé des accomplissements, organisation du lendemain, vérification des alarmes et bascule en mode silencieux.',
      icon: 'Moon',
      color: '#3b82f6',
      enabled: true,
      isBuiltin: true,
      triggers: [
        {
          id: 'trig_n_1',
          type: 'time',
          label: 'Tous les soirs à 23:00',
          enabled: true,
          timeConfig: { time: '23:00', exactAlarm: true },
        },
        {
          id: 'trig_n_2',
          type: 'user_action',
          label: 'Commande Vocale / UI',
          enabled: true,
          userActionConfig: {
            voicePhrases: ['active le mode nuit', 'mode nuit', 'bonne nuit', 'je vais dormir', 'je vais me coucher', 'clôture la journée'],
            shortcutName: 'Mode Nuit',
          },
        },
      ],
      actions: [
        {
          id: 'act_n_summary',
          type: 'tasks_review',
          name: 'Résumé de la Journée & Tâches Terminées',
          description: 'Bilan des objectifs accomplis aujourd\'hui.',
          order: 1,
          enabled: true,
          isSensitive: false,
          params: { scope: 'today_pending' },
        },
        {
          id: 'act_n_tomorrow',
          type: 'calendar_digest',
          name: 'Tâches & Agenda du Lendemain',
          description: 'Aperçu des premiers rendez-vous et priorités de demain matin.',
          order: 2,
          enabled: true,
          isSensitive: false,
          params: { timeframe: 'tomorrow', maxEvents: 4 },
        },
        {
          id: 'act_n_reminders',
          type: 'important_messages',
          name: 'Vérification Rappels & Alarmes Réveil',
          description: 'Confirmation de l\'état de l\'alarme réveil et des alertes programmées.',
          order: 3,
          enabled: true,
          isSensitive: false,
          params: { sources: ['calls', 'sms'], unreadOnly: true, urgentOnly: false },
        },
        {
          id: 'act_n_settings',
          type: 'device_settings',
          name: 'Paramètres Nocturnes (DND & Écran Sombre)',
          description: 'Luminosité réduite à 15%, Ne Pas Déranger activé, extinction des périphériques connectés.',
          order: 4,
          enabled: true,
          isSensitive: false,
          params: { dnd: true, screenBrightnessPercent: 15, darkTheme: true, volumePercent: 10 },
        },
        {
          id: 'act_n_voice',
          type: 'voice_briefing',
          name: 'Message Vocal de Bonne Nuit',
          description: 'Souhaits d\'un repos bien mérité et confirmation de la veille sécurisée.',
          order: 5,
          enabled: true,
          isSensitive: false,
          params: { tone: 'calm', customIntro: 'Excellente nuit, Monsieur. Vos protocoles sont sécurisés et votre réveil est prêt pour demain.' },
        },
      ],
      executionPolicy: {
        stopOnError: false,
        parallelExecutionAllowed: true,
        requireBiometricConfirmationForSensitive: false,
        wakeScreenOnRun: false,
        keepForegroundNotification: false,
      },
      stats: {
        runCount: 22,
        lastRunAt: now - 1000 * 3600 * 30,
        lastRunStatus: 'success',
        lastDurationMs: 1250,
      },
      createdAt: now - 1000 * 3600 * 24 * 14,
      updatedAt: now,
    };

    this.routines.set(morningRoutine.id, morningRoutine);
    this.routines.set(workRoutine.id, workRoutine);
    this.routines.set(nightRoutine.id, nightRoutine);
  }

  private syncScheduler() {
    routineScheduler.syncRoutinesWithAndroidScheduler(this.getAllRoutines());
  }

  // --- CRUD Operations ---

  public getAllRoutines(): SmartRoutine[] {
    return Array.from(this.routines.values());
  }

  public getRoutine(id: string): SmartRoutine | undefined {
    return this.routines.get(id);
  }

  public createCustomRoutine(data: {
    name: string;
    description: string;
    icon?: string;
    color?: string;
    triggers?: RoutineTrigger[];
    actions?: RoutineAction[];
    executionPolicy?: Partial<SmartRoutine['executionPolicy']>;
  }): SmartRoutine {
    const id = `routine_custom_${Date.now()}`;
    const now = Date.now();

    const newRoutine: SmartRoutine = {
      id,
      name: data.name.trim(),
      presetKey: 'custom',
      description: data.description.trim(),
      icon: data.icon || 'Sparkles',
      color: data.color || '#10b981',
      enabled: true,
      isBuiltin: false,
      triggers: data.triggers || [
        {
          id: `trig_${Date.now()}`,
          type: 'user_action',
          label: 'Commande vocale / Manuel',
          enabled: true,
          userActionConfig: {
            voicePhrases: [data.name.toLowerCase(), `lance ${data.name.toLowerCase()}`],
          },
        },
      ],
      actions: data.actions || [
        {
          id: `act_${Date.now()}`,
          type: 'voice_briefing',
          name: 'Annonce vocale personnalisée',
          description: `Exécution de la routine ${data.name}`,
          order: 1,
          enabled: true,
          isSensitive: false,
          params: { customIntro: `Routine ${data.name} exécutée, Monsieur.` },
        },
      ],
      executionPolicy: {
        stopOnError: false,
        parallelExecutionAllowed: true,
        requireBiometricConfirmationForSensitive: true,
        wakeScreenOnRun: true,
        keepForegroundNotification: false,
        ...data.executionPolicy,
      },
      stats: {
        runCount: 0,
        lastRunAt: null,
        lastRunStatus: null,
        lastDurationMs: null,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.routines.set(id, newRoutine);
    this.syncScheduler();
    return newRoutine;
  }

  public updateRoutine(
    id: string,
    updates: Partial<Omit<SmartRoutine, 'id' | 'createdAt'>>
  ): SmartRoutine | null {
    const routine = this.routines.get(id);
    if (!routine) return null;

    const updated: SmartRoutine = {
      ...routine,
      ...updates,
      updatedAt: Date.now(),
    };

    this.routines.set(id, updated);
    this.syncScheduler();
    return updated;
  }

  public deleteRoutine(id: string): boolean {
    const routine = this.routines.get(id);
    if (!routine) return false;
    if (routine.isBuiltin) {
      // For built-in routines, we disable them rather than deleting
      routine.enabled = false;
      this.syncScheduler();
      return true;
    }

    const res = this.routines.delete(id);
    this.syncScheduler();
    return res;
  }

  public toggleRoutine(id: string): boolean | null {
    const routine = this.routines.get(id);
    if (!routine) return null;

    routine.enabled = !routine.enabled;
    routine.updatedAt = Date.now();
    this.syncScheduler();
    return routine.enabled;
  }

  // --- Execution Engine ---

  /**
   * Executes a routine immediately, coordinating steps and building the synthesized spoken briefing
   */
  public async executeRoutine(
    routineId: string,
    triggerSource: string = 'manual_ui',
    confirmationTokens?: Record<string, string>
  ): Promise<RoutineExecutionReport> {
    const routine = this.routines.get(routineId);
    if (!routine) {
      throw new Error(`Routine '${routineId}' introuvable.`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    const stepLogs: RoutineExecutionStepLog[] = [];
    const pendingConfirmations: RoutineExecutionReport['pendingConfirmations'] = [];

    // Sort actions by order
    const sortedActions = [...routine.actions]
      .filter((a) => a.enabled)
      .sort((a, b) => a.order - b.order);

    for (const action of sortedActions) {
      const providedToken = confirmationTokens ? confirmationTokens[action.id] : undefined;
      const stepLog = await actionManager.executeAction(routine.id, action, providedToken);
      stepLogs.push(stepLog);

      if (stepLog.status === 'requires_confirmation' && stepLog.confirmationRequired) {
        pendingConfirmations.push({
          token: stepLog.confirmationRequired.token,
          actionId: action.id,
          description: stepLog.confirmationRequired.description,
          riskLevel: stepLog.confirmationRequired.riskLevel,
        });

        if (routine.executionPolicy.stopOnError) {
          break;
        }
      }

      if (stepLog.status === 'failed' && routine.executionPolicy.stopOnError) {
        break;
      }
    }

    const completedAt = Date.now();
    const totalDurationMs = completedAt - startedAt;

    let overallStatus: RoutineExecutionReport['status'] = 'success';
    if (pendingConfirmations.length > 0) {
      overallStatus = 'awaiting_confirmation';
    } else if (stepLogs.some((s) => s.status === 'failed')) {
      overallStatus = stepLogs.every((s) => s.status === 'failed') ? 'failed' : 'partial';
    }

    // Synthesize fluent JARVIS Spoken Briefing
    const spokenBriefing = this.synthesizeSpokenBriefing(routine, stepLogs);

    // Update routine stats
    routine.stats.runCount += 1;
    routine.stats.lastRunAt = completedAt;
    routine.stats.lastRunStatus = overallStatus === 'failed' ? 'error' : overallStatus === 'partial' ? 'warning' : 'success';
    routine.stats.lastDurationMs = totalDurationMs;
    routine.updatedAt = completedAt;

    // Track foreground notification if policy requires
    if (routine.executionPolicy.keepForegroundNotification) {
      routineScheduler.setForegroundRoutineState(routine.id, true);
    }

    const report: RoutineExecutionReport = {
      executionId,
      routineId: routine.id,
      routineName: routine.name,
      triggerSource,
      startedAt,
      completedAt,
      totalDurationMs,
      status: overallStatus,
      steps: stepLogs,
      spokenBriefing,
      pendingConfirmations: pendingConfirmations.length > 0 ? pendingConfirmations : undefined,
    };

    this.executionHistory.unshift(report);
    if (this.executionHistory.length > 50) {
      this.executionHistory.pop();
    }

    return report;
  }

  /**
   * Generates natural language spoken synthesis for JARVIS TTS
   */
  private synthesizeSpokenBriefing(
    routine: SmartRoutine,
    steps: RoutineExecutionStepLog[]
  ): string {
    const weatherStep = steps.find((s) => s.actionType === 'weather_briefing' && s.status === 'success');
    const calendarStep = steps.find((s) => s.actionType === 'calendar_digest' && s.status === 'success');
    const messagesStep = steps.find((s) => s.actionType === 'important_messages' && s.status === 'success');
    const tasksStep = steps.find((s) => s.actionType === 'tasks_review' && s.status === 'success');

    if (routine.presetKey === 'morning') {
      let briefing = "Mes salutations, Monsieur. Voici votre rapport matinal : ";
      if (weatherStep?.result) {
        briefing += `À ${weatherStep.result.city}, le ciel est ${weatherStep.result.condition.toLowerCase()} avec ${weatherStep.result.temperatureC}°C. `;
      }
      if (calendarStep?.result?.nextMeeting) {
        briefing += `Votre premier rendez-vous est prévu à ${new Date(calendarStep.result.nextMeeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} pour "${calendarStep.result.nextMeeting.title}". `;
      } else {
        briefing += "Votre agenda est dégagé pour la matinée. ";
      }
      if (tasksStep && tasksStep.result && tasksStep.result.urgentCount > 0) {
        briefing += `Vous avez ${tasksStep.result.urgentCount} tâche(s) prioritaire(s) à traiter aujourd'hui. `;
      }
      if (messagesStep && messagesStep.result && messagesStep.result.unreadEmails > 0) {
        briefing += `${messagesStep.result.unreadEmails} messages importants non lus attendent votre consultation. `;
      }
      briefing += "Tous les systèmes du terminal sont optimisés. Excellente journée à vous.";
      return briefing;
    }

    if (routine.presetKey === 'work') {
      let briefing = "Mode Travail & Hyperfocus opérationnel, Monsieur. ";
      briefing += "Le mode Ne Pas Déranger a été activé, l'environnement de développement est chargé et vos notifications secondaires sont filtrées. ";
      if (calendarStep && calendarStep.result && calendarStep.result.eventCount > 0) {
        briefing += `Vous avez ${calendarStep.result.eventCount} réunion(s) prévues au planning aujourd'hui. `;
      }
      briefing += "Je filtre les distractions en arrière-plan.";
      return briefing;
    }

    if (routine.presetKey === 'night') {
      let briefing = "Rapport de clôture de journée, Monsieur. ";
      if (tasksStep && tasksStep.result) {
        briefing += `Le bilan de vos activités est enregistré. `;
      }
      if (calendarStep && calendarStep.result && calendarStep.result.eventCount > 0) {
        briefing += `Pour demain, votre premier engagement est calé avec ${calendarStep.result.eventCount} rendez-vous au programme. `;
      }
      briefing += "L'écran a été tamisé, le mode silencieux est verrouillé et votre réveil est armé. Reposez-vous bien, Monsieur.";
      return briefing;
    }

    // Generic Custom Routine Briefing
    const voiceStep = steps.find((s) => s.actionType === 'voice_briefing');
    if (voiceStep?.result?.introPhrase) {
      return voiceStep.result.introPhrase;
    }

    return `La routine ${routine.name} a été exécutée avec succès, Monsieur. ${steps.filter((s) => s.status === 'success').length} actions accomplies.`;
  }

  public getExecutionHistory(): RoutineExecutionReport[] {
    return this.executionHistory;
  }
}

export const routineEngine = RoutineEngine.getInstance();
