/**
 * GENERAL AI AGENT (OpenJarvis Core)
 * 
 * Default conversational reasoning agent for open domain dialogue,
 * reasoning, conceptual explanations, synthesis, and creative assistance.
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
import { JarvisAiRouter } from '../../ai-router.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class GeneralAiAgent implements SpecializedAgent {
  public readonly id: AgentId = 'general_ai';
  public readonly name = 'JARVIS General AI Agent';
  public readonly description = 'Agent conversationnel général pour le raisonnement, les explications et le dialogue.';
  public readonly permissionLevel: AgentPermissionLevel = 'public';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'general_dialogue',
      name: 'Dialogue Général & Synthèse',
      description: 'Réponses conversationnelles intelligentes, explications conceptuelles et reformulation.',
      tags: ['chat', 'dialogue', 'reasoning', 'explanation', 'general'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'creative_writing',
      name: 'Rédaction & Synthèse créative',
      description: 'Rédaction de résumés, courriers, traductions et synthèses de texte.',
      tags: ['writing', 'summary', 'translation', 'draft'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'summarize_text',
      description: 'Génère un résumé structuré d’un texte long.',
      parameters: { text: { type: 'string', description: 'Le texte à résumer' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    // General AI acts as the versatile default fallback when no specialized domain dominates
    return {
      agentId: this.id,
      score: 0.5, // Base baseline score
      confidence: 0.8,
      reason: 'Requête conversationnelle générale ou demande de raisonnement standard.',
      matchedCapabilities: ['general_dialogue'],
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const systemPrompt = `Tu es JARVIS, l'assistant IA personnel intelligent, concis, élégant et serviable.
Réponds en français avec précision et courtoisie.
Si la réponse nécessite des puces ou une structure, sois clair et aéré.`;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history if present
      if (input.context?.history && input.context.history.length > 0) {
        for (const h of input.context.history.slice(-6)) {
          messages.push({ role: h.role, content: h.content });
        }
      }

      messages.push({ role: 'user', content: input.query });

      let reply = '';
      const onChunk = (chunk: string) => {
        reply += chunk;
        if (input.onChunk) input.onChunk(chunk);
      };

      const result = await JarvisAiRouter.executeStream({
        messages,
        systemPrompt,
        model: input.modelOverride,
        temperature: 0.7,
        timeoutMs: input.timeoutMs || 25000,
        onChunk,
      });

      const latencyMs = Date.now() - startTime;

      // Extract spoken summary (concise 1-2 sentence version)
      const spokenSummary = reply.length > 180 ? reply.split('.')[0] + '.' : reply;

      return {
        id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: false,
        telemetry: {
          providerUsed: result.providerUsed,
          modelUsed: result.modelUsed,
          fallbackOccurred: result.attempts.length > 1,
          providerChainAttempted: result.attempts.map((a) => a.provider),
          executionTimeMs: latencyMs,
        },
        nextSuggestions: [
          'Peux-tu approfondir ce point ?',
          'Résume en 3 points clés',
          'Envoie cette note par message',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    const latency = Date.now() - startTime;
    return {
      id: `err_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Monsieur, une anomalie temporaire est survenue lors du traitement de votre demande.',
      spokenSummary: 'Une anomalie temporaire est survenue.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: latency,
      },
      error: {
        code: 'GENERAL_AI_EXECUTION_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Réessayez votre requête ou vérifiez vos connexions réseau.',
      },
    };
  }
}
