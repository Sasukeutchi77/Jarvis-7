/**
 * MEMORY & CONTEXT AGENT (Specialized Agent - Phase 7)
 * 
 * Manages associative semantic memory, factual recall, learned user habits,
 * project intelligence, preferences retention, and persistent contextual insights.
 * Integrated with MemoryStore, MemoryRetriever, and MemoryManager.
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
import { memoryManager } from '../../memory/memory-manager.js';
import { memoryStore } from '../../memory/memory-store.js';
import { memoryRetriever } from '../../memory/memory-retriever.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class MemoryAgent implements SpecializedAgent {
  public readonly id: AgentId = 'memory';
  public readonly name = 'JARVIS Long-Term Memory Agent';
  public readonly description = 'Spécialiste de la mémoire à long terme, rétention des préférences, mémoire projet, recherche sémantique vectorielle et oubli contrôlé.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'memory_store_fact',
      name: 'Enregistrement Explicite de Faits & Préférences',
      description: 'Mémorisation durable et ciblée d’un fait, d’une habitude ou d’une préférence utilisateur.',
      tags: ['mémorise', 'souviens-toi', 'retient', 'retiens ceci', 'ma préférence', 'enregistre que', 'n’oublie pas'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'memory_recall',
      name: 'Rappel Associatif Sémantique & Projets',
      description: 'Recherche sémantique vectorielle et restitution des connaissances accumulées sur l’utilisateur ou ses projets.',
      tags: ['que sais-tu sur', 'mon projet', 'rappelle-toi', 'quelles sont mes préférences', 'mes notes', 'souvenirs'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'memory_forget',
      name: 'Oubli Sélectif & Purge Mémorielle',
      description: 'Suppression et désindexation vectorielle d’un souvenir ou d’une consigne passée.',
      tags: ['oublie ceci', 'oublie que', 'supprime ce souvenir', 'ne retiens plus', 'efface de ta mémoire'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'remember_user_item',
      description: 'Ajoute un fait ou une préférence dans le magasin mémoriel multi-paliers avec embedding sémantique.',
      parameters: { content: { type: 'string' }, category: { type: 'string' }, tier: { type: 'string' } },
    },
    {
      name: 'forget_user_item',
      description: 'Supprime un souvenir existant et purge son index vectoriel.',
      parameters: { query: { type: 'string' } },
    },
    {
      name: 'search_semantic_memory',
      description: 'Effectue une recherche sémantique pondérée par cosinus et mots-clés.',
      parameters: { query: { type: 'string' }, topK: { type: 'number' } },
    },
    {
      name: 'get_project_memory',
      description: 'Restitue le contexte d’architecture et les décisions clés du projet actif.',
      parameters: { projectId: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase();
    const memKeywords = [
      'souviens-toi', 'mémorise', 'retient', 'retiens ceci', 'retiens que', 'n’oublie pas', 'enregistre dans ma mémoire',
      'que sais-tu sur moi', 'quelles sont mes préférences', 'rappelle-toi de', 'mémoire',
      'oublie ceci', 'oublie que', 'supprime ce souvenir', 'ne retiens plus',
      'que sais-tu sur mon projet', 'qu\'est-ce que tu sais sur mon projet', 'mon projet'
    ];

    let score = 0.05;
    const matches: string[] = [];

    for (const kw of memKeywords) {
      if (q.includes(kw)) {
        score += 0.45;
        if (kw.includes('souviens') || kw.includes('mémorise') || kw.includes('retient')) {
          matches.push('memory_store_fact');
        } else if (kw.includes('oublie') || kw.includes('supprime')) {
          matches.push('memory_forget');
        } else {
          matches.push('memory_recall');
        }
      }
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.5 ? 0.95 : 0.35,
      reason: matches.length > 0
        ? `Gestion du système de mémoire multi-paliers : ${matches.join(', ')}`
        : 'Pas d’action mémoire explicite.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      // 1. Delegate to the unified MemoryManager
      const result = await memoryManager.handleCommand(input.query);

      const actionsExecuted: any[] = [];
      if (result.action === 'remember') {
        actionsExecuted.push({
          tool: 'remember_user_item',
          arguments: { query: input.query },
          result: { stored: true, entries: result.affectedEntries },
          latencyMs: 15,
          success: result.success,
        });
      } else if (result.action === 'forget' || result.action === 'delete') {
        actionsExecuted.push({
          tool: 'forget_user_item',
          arguments: { query: input.query },
          result: { deleted: true, entries: result.affectedEntries },
          latencyMs: 12,
          success: result.success,
        });
      } else {
        actionsExecuted.push({
          tool: 'search_semantic_memory',
          arguments: { query: input.query },
          result: { count: result.affectedEntries?.length || 0 },
          latencyMs: 18,
          success: result.success,
        });
      }

      return {
        id: `out_mem_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: result.success,
        reply: redactSecrets(result.message),
        spokenSummary: redactSecrets(result.spokenSummary),
        actionTaken: true,
        actionsExecuted,
        structuredData: {
          action: result.action,
          affectedEntries: result.affectedEntries,
          projectContext: result.projectContext,
        },
        telemetry: {
          providerUsed: 'memory_vault_engine',
          modelUsed: 'local-hybrid-vector-store',
          fallbackOccurred: false,
          providerChainAttempted: ['memory_vault_engine'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Qu\'est-ce que tu sais sur mon projet ?',
          'Quelles sont mes préférences ?',
          'JARVIS, retiens ceci : j\'aime le café noir sans sucre.',
          'Consulter l\'interface de gestion mémoire',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    console.error(`[MemoryAgent] Error handling input "${input.query}":`, error);
    const msg = error?.message || 'Erreur inattendue lors de la manipulation du magasin de mémoire.';

    return {
      id: `err_mem_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `### ⚠️ Incident du Registre Mémoriel\n\nImpossible d’accéder ou de modifier la mémoire à long terme : \`${msg}\`.`,
      spokenSummary: 'Monsieur, une anomalie est survenue lors de l’accès à votre mémoire.',
      actionTaken: false,
      telemetry: {
        providerUsed: 'local_device',
        modelUsed: 'none',
        fallbackOccurred: true,
        providerChainAttempted: [],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'MEMORY_AGENT_ERROR',
        message: redactSecrets(msg),
        recoverable: true,
        suggestedAction: 'Vérifiez la persistance des données locales.',
      },
    };
  }
}
