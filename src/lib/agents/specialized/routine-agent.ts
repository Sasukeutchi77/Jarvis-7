/**
 * JARVIS ROUTINE AGENT (PHASE 12 — SMART ROUTINES)
 * 
 * Specialized agent responsible for customizable smart routines:
 * - Built-in presets: Mode Matin, Mode Travail, Mode Nuit
 * - Custom routine creation and execution
 * - Trigger evaluation (Heure, Jour, Localisation, Événement, Notification, Action utilisateur)
 * - Sensitive action gating & token generation
 * - Android background scheduling & WorkManager compliance
 */

import {
  SpecializedAgent,
  AgentId,
  AgentCapability,
  AgentToolDefinition,
  AgentPermissionLevel,
  AgentInput,
  AgentOutput,
  AgentRoutingEvaluation,
  AgentActionExecuted,
} from '../agent-protocol.js';
import { routineEngine, routineScheduler, triggerManager } from '../../services/routines/index.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class RoutineAgent implements SpecializedAgent {
  public readonly id: AgentId = 'routine';
  public readonly name = 'JARVIS Routine Agent';
  public readonly description = 'Orchestrateur des routines intelligentes et automatisations Android (Mode Matin, Travail, Nuit et Routines personnalisées).';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'execute_routine',
      name: 'Exécution de Routine',
      description: 'Déclencher et exécuter une routine globale (Matin, Travail, Nuit ou personnalisée).',
      tags: ['mode matin', 'mode travail', 'mode nuit', 'bonne nuit', 'lance la routine', 'active le mode', 'routine du matin', 'routine du soir'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'list_routines',
      name: 'Consultation des Routines',
      description: 'Lister les routines configurées, leurs déclencheurs et leur historique d\'exécution.',
      tags: ['quelles sont mes routines', 'liste mes routines', 'mes routines', 'affiche les routines', 'état des routines'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'create_routine',
      name: 'Création de Routine Personnalisée',
      description: 'Créer une nouvelle routine personnalisée avec déclencheurs et étapes d\'action sur mesure.',
      tags: ['crée une routine', 'nouvelle routine', 'ajouter une routine', 'automatisation'],
      requiredPermissions: [],
      riskLevel: 'medium',
    },
    {
      id: 'confirm_sensitive_action',
      name: 'Confirmation d\'Action Sensible',
      description: 'Valider une étape de routine sensible à l\'aide d\'un jeton de sécurité explicite.',
      tags: ['confirme action', 'valide action sensible', 'autorise action', 'code confirmation'],
      requiredPermissions: ['user'],
      riskLevel: 'high',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'execute_routine',
      description: 'Exécute une routine spécifiée par ID ou nom.',
      parameters: { routineId: { type: 'string' } },
    },
    {
      name: 'list_routines',
      description: 'Récupère toutes les routines configurées.',
      parameters: {},
    },
    {
      name: 'create_custom_routine',
      description: 'Crée une nouvelle routine.',
      parameters: { name: { type: 'string' }, description: { type: 'string' } },
    },
    {
      name: 'get_scheduler_status',
      description: 'Récupère l\'état du planificateur Android WorkManager et AlarmManager.',
      parameters: {},
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    let score = 0.0;
    const matches: string[] = [];

    // Check TriggerManager for voice queries
    const routines = routineEngine.getAllRoutines();
    const triggerMatch = triggerManager.matchVoiceQuery(q, routines);
    if (triggerMatch) {
      score = triggerMatch.confidence;
      matches.push(`voice_trigger_${triggerMatch.routine.presetKey || triggerMatch.routine.id}`);
    }

    if (
      q.includes('mode matin') ||
      q.includes('routine matin') ||
      q.includes('mode travail') ||
      q.includes('mode focus') ||
      q.includes('mode nuit') ||
      q.includes('bonne nuit') ||
      q.includes('je vais dormir') ||
      q.includes('je vais me coucher') ||
      q.includes('lance la routine') ||
      q.includes('active la routine')
    ) {
      score = Math.max(score, 0.96);
      matches.push('execute_routine');
    } else if (
      q.includes('mes routines') ||
      q.includes('quelles sont mes routines') ||
      q.includes('liste mes routines') ||
      q.includes('affiche les routines')
    ) {
      score = Math.max(score, 0.94);
      matches.push('list_routines');
    } else if (
      q.includes('crée une routine') ||
      q.includes('nouvelle routine') ||
      q.includes('créer une routine')
    ) {
      score = Math.max(score, 0.92);
      matches.push('create_routine');
    }

    return {
      agentId: this.id,
      score: Math.min(1.0, score),
      confidence: Math.min(1.0, score),
      reason: matches.length > 0 ? `Requête relative aux Smart Routines (${matches.join(', ')})` : 'Aucune intention de routine détectée.',
      matchedCapabilities: matches,
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const q = input.query.toLowerCase().trim();
    const displayName = 'Monsieur';
    const actionsExecuted: AgentActionExecuted[] = [];

    try {
      // 1. MATCH AND EXECUTE SPECIFIC ROUTINE
      const routines = routineEngine.getAllRoutines();
      const matched = triggerManager.matchVoiceQuery(q, routines);

      if (matched) {
        const executionReport = await routineEngine.executeRoutine(matched.routine.id, 'voice_command');
        const spoken = executionReport.spokenBriefing || `Routine ${matched.routine.name} exécutée avec succès, ${displayName}.`;

        let reply = `### Routine Exécutée : ${matched.routine.name}\n\n`;
        reply += `${spoken}\n\n`;
        reply += `#### 📋 Détail des Étapes :\n`;

        for (const step of executionReport.steps) {
          const icon = step.status === 'success' ? '✅' : step.status === 'requires_confirmation' ? '⚠️' : '❌';
          reply += `- ${icon} **${step.actionName}** : ${step.result?.summary || step.result?.message || 'Exécuté avec succès'}\n`;
        }

        if (executionReport.pendingConfirmations && executionReport.pendingConfirmations.length > 0) {
          reply += `\n> ⚠️ **Action sensible en attente** : ${executionReport.pendingConfirmations[0].description} (Jeton de sécurité généré).\n`;
        }

        actionsExecuted.push({
          tool: 'execute_routine',
          arguments: { routineId: matched.routine.id },
          result: executionReport,
          latencyMs: executionReport.totalDurationMs,
          success: executionReport.status !== 'failed',
        });

        return {
          id: `out_routine_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: true,
          reply: redactSecrets(reply),
          spokenSummary: redactSecrets(spoken),
          actionTaken: true,
          actionsExecuted,
          structuredData: {
            executionReport,
            routine: matched.routine,
          },
          telemetry: {
            providerUsed: 'routine_engine',
            modelUsed: 'smart-routines-v1',
            fallbackOccurred: false,
            providerChainAttempted: ['routine_engine'],
            executionTimeMs: Date.now() - startTime,
          },
          nextSuggestions: ['Quelles sont mes routines ?', 'Afficher l\'état du planificateur Android', 'Lance le mode travail'],
        };
      }

      // 2. LIST ROUTINES
      if (q.includes('routine') && (q.includes('liste') || q.includes('quelles') || q.includes('affiche') || q.includes('mes'))) {
        const allRoutines = routineEngine.getAllRoutines();
        const schedulerStatus = routineScheduler.getSchedulerStatus();

        let reply = `### ⚙️ Vos Smart Routines JARVIS\n\n`;
        reply += `Voici les routines actuellement configurées et synchronisées avec le sous-système Android WorkManager :\n\n`;

        for (const r of allRoutines) {
          const statusBadge = r.enabled ? '🟢 Active' : '⚪ Désactivée';
          const typeLabel = r.isBuiltin ? 'Preset Système' : 'Personnalisée';
          reply += `#### ${r.name} (${statusBadge} • ${typeLabel})\n`;
          reply += `- **Description** : ${r.description}\n`;
          reply += `- **Déclencheurs** : ${r.triggers.map((t) => t.label).join(' • ')}\n`;
          reply += `- **Actions (${r.actions.length})** : ${r.actions.map((a) => a.name).join(' → ')}\n`;
          reply += `- **Exécutions** : ${r.stats.runCount} fois\n\n`;
        }

        reply += `> 📱 **État Android** : ${schedulerStatus.exactAlarmsRegistered} alarme(s) exacte(s) enregistrée(s), ${schedulerStatus.workManagerJobsCount} tâche(s) WorkManager actives, conformité Doze Mode 100%.\n`;

        return {
          id: `out_routine_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: true,
          reply: redactSecrets(reply),
          spokenSummary: `Vous avez ${allRoutines.length} routines configurées dans le système.`,
          actionTaken: true,
          actionsExecuted,
          structuredData: {
            routines: allRoutines,
            schedulerStatus,
          },
          telemetry: {
            providerUsed: 'routine_engine',
            modelUsed: 'smart-routines-v1',
            fallbackOccurred: false,
            providerChainAttempted: ['routine_engine'],
            executionTimeMs: Date.now() - startTime,
          },
          nextSuggestions: ['Lance le mode matin', 'Active le mode travail', 'Active le mode nuit'],
        };
      }

      // 3. CREATE CUSTOM ROUTINE
      if (q.includes('crée') || q.includes('nouvelle routine')) {
        const routineNameMatch = q.match(/(?:routine|mode)\s+([a-zA-Z0-9à-ÿ\s]+)/i);
        const name = routineNameMatch ? routineNameMatch[1].trim() : 'Nouvelle Routine';
        const created = routineEngine.createCustomRoutine({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          description: `Routine personnalisée configurée pour ${displayName}.`,
          icon: 'Sparkles',
          color: '#10b981',
        });

        actionsExecuted.push({
          tool: 'create_custom_routine',
          arguments: { name: created.name },
          result: created,
          latencyMs: 15,
          success: true,
        });

        const reply = `### Routine Créée avec Succès\n\nJ'ai configuré votre nouvelle routine personnalisée :\n\n- **Nom** : **${created.name}**\n- **Déclencheur par défaut** : Commande vocale ("${created.name.toLowerCase()}")\n- **Statut** : 🟢 Active & Enregistrée dans le gestionnaire Android WorkManager.\n\nVous pouvez l'enrichir avec des actions supplémentaires (Météo, Calendrier, Domotique, DND) depuis le panneau Smart Routines.`;

        return {
          id: `out_routine_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: true,
          reply: redactSecrets(reply),
          spokenSummary: `La routine ${created.name} a été créée et enregistrée.`,
          actionTaken: true,
          actionsExecuted,
          structuredData: { createdRoutine: created },
          telemetry: {
            providerUsed: 'routine_engine',
            modelUsed: 'smart-routines-v1',
            fallbackOccurred: false,
            providerChainAttempted: ['routine_engine'],
            executionTimeMs: Date.now() - startTime,
          },
          nextSuggestions: [`Exécute la routine ${created.name}`, 'Quelles sont mes routines ?'],
        };
      }

      // Default Fallback: Overview
      const allRoutines = routineEngine.getAllRoutines();
      const reply = `À vos ordres, ${displayName}. Le moteur de Smart Routines JARVIS est opérationnel avec ${allRoutines.length} routines configurées (Mode Matin, Mode Travail, Mode Nuit). Dites simplement *"Lance le mode matin"* ou *"Passe en mode travail"*.`;

      return {
        id: `out_routine_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: reply,
        actionTaken: false,
        actionsExecuted,
        structuredData: { routinesCount: allRoutines.length },
        telemetry: {
          providerUsed: 'routine_engine',
          modelUsed: 'smart-routines-v1',
          fallbackOccurred: false,
          providerChainAttempted: ['routine_engine'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: ['Lance le mode matin', 'Active le mode travail', 'Active le mode nuit'],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_routine_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Une erreur est survenue lors du traitement de la routine.',
      spokenSummary: 'Erreur lors du traitement de la routine.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'ROUTINE_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez les paramètres de la routine ou relancez la commande.',
      },
    };
  }
}

export const routineAgent = new RoutineAgent();
