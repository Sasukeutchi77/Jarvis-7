/**
 * JARVIS TASK AGENT (PHASE 11 — PERSONAL ASSISTANT)
 * 
 * Specialized agent responsible for task lifecycle:
 * - Adding tasks ("Ajoute une tâche...")
 * - Deleting tasks ("Supprime cette tâche...")
 * - Completing / toggling tasks
 * - Prioritizing and listing pending tasks
 * - Optional sync with Google Tasks (OAuth) & Android Content Provider
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
} from '../agent-protocol.js';
import { personalAssistantManager, PersonalTask } from '../../services/assistant/personal-assistant-service.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class TaskAgent implements SpecializedAgent {
  public readonly id: AgentId = 'task';
  public readonly name = 'JARVIS Task Agent';
  public readonly description = 'Spécialiste de la gestion des tâches personnelles, création, suppression, priorisation et suivi d’avancement.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'create_task',
      name: 'Création de Tâche',
      description: 'Créer et catégoriser une nouvelle tâche avec niveau de priorité et date d’échéance.',
      tags: ['ajoute une tâche', 'nouvelle tâche', 'créer une tâche', 'to-do', 'ajouter tâche', 'faire'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'delete_task',
      name: 'Suppression de Tâche',
      description: 'Supprimer une tâche existante ou la tâche active en cours.',
      tags: ['supprime cette tâche', 'supprimer la tâche', 'efface la tâche', 'enlève la tâche', 'annule la tâche'],
      requiredPermissions: [],
      riskLevel: 'medium',
    },
    {
      id: 'list_tasks',
      name: 'Consultation & Triage des Tâches',
      description: 'Lister, filtrer par priorité et afficher les tâches en cours ou terminées.',
      tags: ['quelles sont mes tâches', 'liste mes tâches', 'mes tâches', 'tâches urgentes', 'tâches du jour'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'complete_task',
      name: 'Validation de Tâche',
      description: 'Marquer une tâche comme terminée ou basculer son statut.',
      tags: ['tâche terminée', 'marque comme fait', 'c’est fait', 'termine la tâche'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'create_task',
      description: 'Crée une nouvelle tâche.',
      parameters: { title: { type: 'string' }, priority: { type: 'string' }, category: { type: 'string' } },
    },
    {
      name: 'delete_task',
      description: 'Supprime une tâche par ID ou par texte.',
      parameters: { queryOrId: { type: 'string' } },
    },
    {
      name: 'list_tasks',
      description: 'Récupère la liste des tâches actives.',
      parameters: { completed: { type: 'boolean' } },
    },
    {
      name: 'toggle_task',
      description: 'Bascule l’état de complétion d’une tâche.',
      parameters: { taskId: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    let score = 0.0;
    const matches: string[] = [];

    // Highest priority triggers
    if (q.includes('ajoute une tâche') || q.includes('ajouter une tâche') || q.includes('créer une tâche') || q.includes('ajoute la tâche') || q.startsWith('ajoute tâche')) {
      score = 0.98;
      matches.push('create_task');
    } else if (q.includes('supprime cette tâche') || q.includes('supprimer cette tâche') || q.includes('supprime la tâche') || q.includes('efface cette tâche')) {
      score = 0.98;
      matches.push('delete_task');
    } else if (q.includes('quelles sont mes tâches') || q.includes('liste mes tâches') || q.includes('mes tâches') || q.includes('tâches à faire') || q.includes('tâches en cours')) {
      score = 0.95;
      matches.push('list_tasks');
    } else if (q.includes('termine la tâche') || q.includes('tâche terminée') || q.includes('marque la tâche')) {
      score = 0.95;
      matches.push('complete_task');
    } else if (q.includes('tâche') || q.includes('tâches') || q.includes('to-do')) {
      score = 0.85;
      matches.push('list_tasks');
    }

    return {
      agentId: this.id,
      score: Math.min(score, 1.0),
      confidence: score > 0.7 ? 0.96 : 0.4,
      reason: matches.length > 0
        ? `Intention de gestion des tâches identifiée : ${matches.join(', ')}`
        : 'Pas d’intention de tâche directe.',
      matchedCapabilities: matches,
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const q = input.query.trim();
      const lower = q.toLowerCase();
      let reply = '';
      let spokenSummary = '';
      const actionsExecuted: any[] = [];
      let structuredData: any = {};

      // 1. ADD / CREATE TASK
      if (lower.includes('ajoute') || lower.includes('créer') || lower.includes('nouvelle tâche')) {
        // Extract title from query: e.g. "Ajoute une tâche acheter du pain" -> "Acheter du pain"
        let title = q
          .replace(/^(jarvis[\s,:]*)?(ajoute|ajouter|crée|créer|nouvelle)\s+(une\s+tâche|la\s+tâche|tâche)?\s*(:|\-)?\s*/i, '')
          .trim();

        if (!title || title.length < 2) {
          title = 'Nouvelle tâche planifiée';
        }

        // Determine priority
        let priority: PersonalTask['priority'] = 'medium';
        if (lower.includes('urgent') || lower.includes('urgente') || lower.includes('très important')) {
          priority = 'urgent';
        } else if (lower.includes('important') || lower.includes('prioritaire')) {
          priority = 'high';
        }

        // Determine category
        let category: PersonalTask['category'] = 'Personnel';
        if (lower.includes('travail') || lower.includes('bureau') || lower.includes('pro')) {
          category = 'Travail';
        } else if (lower.includes('projet') || lower.includes('jarvis')) {
          category = 'Projet';
        } else if (lower.includes('course') || lower.includes('acheter') || lower.includes('magasin')) {
          category = 'Courses';
        }

        const task = personalAssistantManager.createTask({
          title,
          priority,
          category,
        });

        reply = `✅ **Tâche enregistrée avec succès dans votre liste Android :**\n\n- **Intitulé** : ${task.title}\n- **Priorité** : ${task.priority.toUpperCase()}\n- **Catégorie** : ${task.category}\n- **ID Système** : \`${task.id}\`\n\n_Stockage local Android prêt pour synchronisation facultative._`;
        spokenSummary = `J'ai ajouté la tâche : "${task.title}".`;

        actionsExecuted.push({
          tool: 'create_task',
          arguments: { title, priority, category },
          result: { task, status: 'created' },
          latencyMs: Date.now() - startTime,
          success: true,
        });

        structuredData = { createdTask: task, totalTasks: personalAssistantManager.getTasks().length };
      }

      // 2. DELETE TASK ("Supprime cette tâche")
      else if (lower.includes('supprime') || lower.includes('efface') || lower.includes('enlève')) {
        let targetText = q
          .replace(/^(jarvis[\s,:]*)?(supprime|supprimer|efface|effacer|enlève|enlever)\s+(cette\s+tâche|la\s+tâche|tâche)?\s*(:|\-)?\s*/i, '')
          .trim();

        const delResult = personalAssistantManager.deleteTask(targetText);

        if (delResult.success) {
          reply = `🗑️ **Tâche supprimée avec succès :**\n\n- **Titre** : "${delResult.deletedTask?.title}"\n- **Catégorie** : ${delResult.deletedTask?.category}\n- **Statut** : Retirée du registre local Android.`;
          spokenSummary = `La tâche "${delResult.deletedTask?.title}" a été supprimée.`;
        } else {
          reply = `⚠️ **Impossible de supprimer la tâche :** ${delResult.message}\n\nVérifiez les tâches en cours via la commande : "Quelles sont mes tâches ?".`;
          spokenSummary = delResult.message;
        }

        actionsExecuted.push({
          tool: 'delete_task',
          arguments: { queryOrId: targetText },
          result: delResult,
          latencyMs: Date.now() - startTime,
          success: delResult.success,
        });

        structuredData = { deletionResult: delResult };
      }

      // 3. COMPLETE TASK
      else if (lower.includes('termine') || lower.includes('terminée') || lower.includes('fait') || lower.includes('valide')) {
        const pending = personalAssistantManager.getTasks({ completed: false });
        if (pending.length > 0) {
          const topTask = pending[0];
          personalAssistantManager.toggleTaskCompletion(topTask.id);
          reply = `✔️ **Tâche marquée comme terminée :**\n\n- **"${topTask.title}"** a été validée.`;
          spokenSummary = `C'est noté, la tâche "${topTask.title}" est marquée comme faite.`;
        } else {
          reply = `Toutes vos tâches sont déjà validées.`;
          spokenSummary = `Vous n'avez aucune tâche en attente.`;
        }

        actionsExecuted.push({
          tool: 'toggle_task',
          arguments: {},
          result: { updated: true },
          latencyMs: Date.now() - startTime,
          success: true,
        });
      }

      // 4. LIST TASKS
      else {
        const tasks = personalAssistantManager.getTasks();
        const pending = tasks.filter((t) => !t.completed);
        const done = tasks.filter((t) => t.completed);

        const lines: string[] = [];
        lines.push(`📋 **VOS TÂCHES ACTUELLES (${pending.length} EN ATTENTE, ${done.length} TERMINÉES) :**\n`);

        if (pending.length === 0) {
          lines.push(`_Aucune tâche en attente. Votre to-do list est vide !_\n`);
        } else {
          pending.forEach((t) => {
            const pBadge = t.priority === 'urgent' ? '🔴 [URGENT]' : t.priority === 'high' ? '🟠 [ÉLEVÉE]' : '🔵';
            lines.push(`- [ ] **${t.title}** ${pBadge} _(${t.category})_`);
          });
          lines.push('');
        }

        if (done.length > 0) {
          lines.push(`**Récemment terminées :**`);
          done.slice(0, 3).forEach((t) => {
            lines.push(`- [x] ~~${t.title}~~`);
          });
        }

        reply = lines.join('\n');
        spokenSummary = `Vous avez ${pending.length} tâche${pending.length > 1 ? 's' : ''} en attente.`;

        actionsExecuted.push({
          tool: 'list_tasks',
          arguments: { total: tasks.length },
          result: { count: tasks.length, pendingCount: pending.length },
          latencyMs: Date.now() - startTime,
          success: true,
        });

        structuredData = { tasks, pendingCount: pending.length };
      }

      return {
        id: `out_task_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: true,
        actionsExecuted,
        structuredData,
        telemetry: {
          providerUsed: 'assistant_core',
          modelUsed: 'task-lifecycle-v1',
          fallbackOccurred: false,
          providerChainAttempted: ['assistant_core'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Ajoute une tâche',
          'Supprime cette tâche',
          'Quelles sont mes tâches ?',
          'Qu’est-ce que j’ai aujourd’hui ?',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_task_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Une erreur est survenue lors de la gestion de la tâche.',
      spokenSummary: 'Erreur lors de la gestion des tâches.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'TASK_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Réessayez la commande ou vérifiez la syntaxe.',
      },
    };
  }
}
