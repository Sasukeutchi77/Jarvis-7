/**
 * JARVIS NOTES AGENT (PHASE 11 — PERSONAL ASSISTANT)
 * 
 * Specialized agent responsible for:
 * - Quick voice & text note taking ("Prends une note...", "Note ceci...")
 * - Note search and retrieval ("Retrouve ma note sur...", "Cherche dans mes notes...")
 * - Color categorisation, tag indexing and pin/unpin toggles
 * - Optional sync with Google Keep (OAuth) & local Android SQLite repository
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
import { personalAssistantManager, PersonalNote } from '../../services/assistant/personal-assistant-service.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class NotesAgent implements SpecializedAgent {
  public readonly id: AgentId = 'notes';
  public readonly name = 'JARVIS Notes Agent';
  public readonly description = 'Spécialiste de la prise de notes rapides, recherche textuelle, classement par tags et mémorisation d’idées.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'create_note',
      name: 'Prise de Note Rapide',
      description: 'Créer une note horodatée avec détection automatique du titre et des tags.',
      tags: ['prends une note', 'note ceci', 'ajoute une note', 'nouvelle note', 'note pour plus tard', 'mémorise'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'search_notes',
      name: 'Recherche dans les Notes',
      description: 'Rechercher des notes par mot-clé, thème ou tag.',
      tags: ['retrouve ma note', 'cherche dans mes notes', 'trouve la note', 'notes sur'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'list_notes',
      name: 'Consultation des Notes',
      description: 'Afficher les notes récentes et épinglées.',
      tags: ['quelles sont mes notes', 'montre mes notes', 'mes notes', 'liste des notes'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'create_note',
      description: 'Crée une nouvelle note.',
      parameters: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array' } },
    },
    {
      name: 'search_notes',
      description: 'Cherche dans les notes.',
      parameters: { query: { type: 'string' } },
    },
    {
      name: 'list_notes',
      description: 'Liste toutes les notes.',
      parameters: {},
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    let score = 0.0;
    const matches: string[] = [];

    if (
      q.includes('prends une note') ||
      q.includes('ajoute une note') ||
      q.includes('nouvelle note') ||
      q.includes('note ceci') ||
      q.startsWith('note :') ||
      q.startsWith('note pour plus tard')
    ) {
      score = 0.98;
      matches.push('create_note');
    } else if (q.includes('cherche dans mes notes') || q.includes('retrouve ma note') || q.includes('note sur')) {
      score = 0.95;
      matches.push('search_notes');
    } else if (q.includes('mes notes') || q.includes('quelles sont mes notes') || q.includes('liste des notes')) {
      score = 0.92;
      matches.push('list_notes');
    }

    return {
      agentId: this.id,
      score: Math.min(score, 1.0),
      confidence: score > 0.7 ? 0.96 : 0.35,
      reason: matches.length > 0
        ? `Intention de prise ou recherche de notes identifiée : ${matches.join(', ')}`
        : 'Pas d’intention de notes.',
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

      // 1. CREATE NOTE
      if (
        lower.includes('prends') ||
        lower.includes('ajoute') ||
        lower.includes('nouvelle note') ||
        lower.includes('note ceci')
      ) {
        let content = q
          .replace(/^(jarvis[\s,:]*)?(prends\s+une\s+note|ajoute\s+une\s+note|nouvelle\s+note|note\s+ceci|note)\s*(:|que|sur)?\s*/i, '')
          .trim();

        if (!content) {
          content = 'Note rapide enregistrée';
        }

        const lines = content.split('\n');
        const title = lines[0].length > 40 ? lines[0].substring(0, 37) + '...' : lines[0];

        const note = personalAssistantManager.createNote({
          title: title || 'Note vocale JARVIS',
          content,
          tags: ['Vocal', 'JARVIS'],
          color: 'amber',
        });

        reply = `📝 **Note enregistrée dans votre carnet Android :**\n\n- **Titre** : ${note.title}\n- **Contenu** : "${note.content}"\n- **Tags** : \`${note.tags.join(', ')}\`\n- **ID** : \`${note.id}\`\n\n_Stockée en local, prête pour synchronisation optionnelle._`;
        spokenSummary = `Note enregistrée : "${note.title}".`;

        actionsExecuted.push({
          tool: 'create_note',
          arguments: { title: note.title, length: note.content.length },
          result: { note },
          latencyMs: Date.now() - startTime,
          success: true,
        });

        structuredData = { note };
      }

      // 2. SEARCH NOTES
      else if (lower.includes('cherche') || lower.includes('retrouve') || lower.includes('trouve')) {
        const queryTerm = q.replace(/^(jarvis[\s,:]*)?(cherche\s+dans\s+mes\s+notes|retrouve\s+ma\s+note\s+sur|cherche|trouve)\s*/i, '').trim();
        const results = personalAssistantManager.getNotes(queryTerm);

        const lines: string[] = [];
        lines.push(`🔍 **RÉSULTATS DE RECHERCHE DANS VOS NOTES ("${queryTerm}") :**\n`);

        if (results.length === 0) {
          lines.push(`_Aucune note correspondant au terme "${queryTerm}"._`);
          spokenSummary = `Aucune note trouvée pour "${queryTerm}".`;
        } else {
          results.forEach((n) => {
            lines.push(`- 📌 **${n.title}** : ${n.content.replace(/\n/g, ' ')} _[${n.tags.join(', ')}]_`);
          });
          spokenSummary = `${results.length} note${results.length > 1 ? 's' : ''} trouvée${results.length > 1 ? 's' : ''}.`;
        }

        reply = lines.join('\n');

        actionsExecuted.push({
          tool: 'search_notes',
          arguments: { query: queryTerm },
          result: { count: results.length },
          latencyMs: Date.now() - startTime,
          success: true,
        });

        structuredData = { searchResults: results };
      }

      // 3. LIST NOTES
      else {
        const notes = personalAssistantManager.getNotes();
        const lines: string[] = [];
        lines.push(`📝 **VOS NOTES ENREGISTRÉES (${notes.length}) :**\n`);

        notes.forEach((n) => {
          lines.push(`- ${n.pinned ? '⭐ ' : ''}**${n.title}**\n  ${n.content.split('\n')[0]}`);
          lines.push(`  _Tags: ${n.tags.join(', ')}_ • _Modifié le ${new Date(n.updatedAt).toLocaleDateString('fr-FR')}_\n`);
        });

        reply = lines.join('\n');
        spokenSummary = `Vous avez ${notes.length} note${notes.length > 1 ? 's' : ''} enregistrée${notes.length > 1 ? 's' : ''}.`;

        actionsExecuted.push({
          tool: 'list_notes',
          arguments: {},
          result: { count: notes.length },
          latencyMs: Date.now() - startTime,
          success: true,
        });

        structuredData = { notes };
      }

      return {
        id: `out_notes_${Date.now()}`,
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
          modelUsed: 'notes-store-engine',
          fallbackOccurred: false,
          providerChainAttempted: ['assistant_core'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Prends une note',
          'Quelles sont mes notes ?',
          'Qu’est-ce que j’ai aujourd’hui ?',
          'Ajoute une tâche',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_notes_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Une erreur est survenue lors de la gestion des notes.',
      spokenSummary: 'Erreur lors de la prise de notes.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'NOTES_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez le contenu de la note ou réessayez.',
      },
    };
  }
}
