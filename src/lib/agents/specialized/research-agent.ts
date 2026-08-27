/**
 * RESEARCH & WEB AGENT (Specialized Agent — Phase 8)
 * 
 * Manages live web grounding, multi-source search (Tavily),
 * search planning, source extraction & validation, 3-tier fact categorization,
 * and comprehensive zero-hallucination reporting.
 * 
 * Commands:
 * - "Recherche les dernières nouvelles."
 * - "Compare ces téléphones."
 * - "Trouve les informations officielles."
 * - "Fais-moi un rapport."
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
import { WebSearchService, SearchPlan, SearchResponse } from '../../services/web-search-service.js';
import { JarvisAiRouter } from '../../ai-router.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class ResearchAgent implements SpecializedAgent {
  public readonly id: AgentId = 'research';
  public readonly name = 'JARVIS Web & Research Agent';
  public readonly description = 'Spécialiste de la recherche web en temps réel, planification d’investigation, vérification de sources et synthèses multi-angles (Tavily).';
  public readonly permissionLevel: AgentPermissionLevel = 'public';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'web_search_grounding',
      name: 'Recherche Web & Actualités en Direct',
      description: 'Collecte et synthèse en temps réel des dernières actualités, faits récents et données du web.',
      tags: [
        'recherche les dernières nouvelles',
        'dernières nouvelles',
        'actualité',
        'actualités',
        'news',
        'cherche sur le web',
        'recherche',
        'cours',
        'météo',
        'faits récents',
        'qui a gagné',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'comparison_analysis',
      name: 'Comparatif & Évaluation Multi-Entités',
      description: 'Comparaison rigoureuse de produits, technologies, téléphones ou options avec analyse technique.',
      tags: [
        'compare ces téléphones',
        'compare',
        'comparatif',
        'différence entre',
        'lequel choisir',
        'vs',
        'face à face',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'official_sources_verification',
      name: 'Vérification de Sources Officielles',
      description: 'Extraction et validation de communiqués, documentations techniques et sources institutionnelles certifiées.',
      tags: [
        'trouve les informations officielles',
        'informations officielles',
        'source officielle',
        'communiqué officiel',
        'documentation officielle',
        'site officiel',
        'institutionnel',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'investigation_report',
      name: 'Dossier d’Investigation & Rapports Détaillés',
      description: 'Génération de rapports complets, structurés et étayés avec triple distinction des faits (trouvé, déduit, inconnu).',
      tags: [
        'fais-moi un rapport',
        'fais un rapport',
        'rapport complet',
        'dossier complet',
        'analyse approfondie',
        'synthèse documentaire',
      ],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'plan_web_search',
      description: 'Planifie la stratégie de recherche et décompose la requête en sous-questions.',
      parameters: { query: { type: 'string' } },
    },
    {
      name: 'execute_web_search',
      description: 'Interroge le web en direct via Tavily avec validation de sources et cache.',
      parameters: { query: { type: 'string' }, depth: { type: 'string', enum: ['basic', 'advanced'] } },
    },
    {
      name: 'validate_sources',
      description: 'Vérifie la fiabilité, la fraîcheur et les domaines des résultats collectés.',
      parameters: { count: { type: 'number' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    let score = 0.05;
    const matches: string[] = [];

    // Phase 8 Direct Command Matches
    if (q.includes('dernières nouvelles') || q.includes('derniere nouvelle') || q.includes('actualité') || q.includes('news')) {
      score += 0.85;
      matches.push('web_search_grounding');
    }

    if (q.includes('compare') || q.includes('comparatif') || q.includes('téléphones') || q.includes(' vs ') || q.includes('différence entre')) {
      score += 0.90;
      matches.push('comparison_analysis');
    }

    if (q.includes('officiel') || q.includes('officielle') || q.includes('sources officielles') || q.includes('constructeur')) {
      score += 0.90;
      matches.push('official_sources_verification');
    }

    if (q.includes('rapport') || q.includes('dossier') || q.includes('fais-moi un rapport') || q.includes('synthèse')) {
      score += 0.88;
      matches.push('investigation_report');
    }

    // General Web triggers
    const researchKeywords = [
      'cherche', 'recherche sur google', 'cherche sur le web', 'trouve sur internet',
      'cours de la bourse', 'qui a gagné', 'résultats', 'météo', 'qui est', 'quand aura lieu',
    ];

    for (const kw of researchKeywords) {
      if (q.includes(kw)) {
        score += 0.45;
        matches.push('web_search_grounding');
      }
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.6 ? 0.95 : score > 0.3 ? 0.75 : 0.2,
      reason: matches.length > 0
        ? `Requête de recherche/investigation web détectée (${matches.join(', ')})`
        : 'Pas de demande explicite de recherche web.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const actionsExecuted: AgentOutput['actionsExecuted'] = [];

    try {
      // 1. PIPELINE STEP 1 & 2: Question & Search Planning
      const cleanQuery = input.query
        .replace(/^(jarvis|cherche sur le web|recherche sur internet|recherche|cherche|trouve)\s+/i, '')
        .trim() || input.query;

      const plan: SearchPlan = WebSearchService.planSearch(cleanQuery);
      actionsExecuted.push({
        tool: 'plan_web_search',
        arguments: {
          category: plan.category,
          primaryQuery: plan.primaryQuery,
          subQueriesCount: plan.subQueries.length,
          depth: plan.searchDepth,
        },
        result: {
          planRationale: plan.rationale,
          targetQueries: [plan.primaryQuery, ...plan.subQueries.slice(0, 2)],
        },
        latencyMs: 15,
        success: true,
      });

      // 2. PIPELINE STEP 3: Web Search via Tavily (with smart cache)
      const searchStartTime = Date.now();
      let searchRes: SearchResponse;
      try {
        searchRes = await WebSearchService.search(plan.primaryQuery, {
          searchDepth: plan.searchDepth,
          maxResults: plan.category === 'detailed_report' || plan.category === 'comparison' ? 6 : 4,
        });
      } catch (searchError: any) {
        // Controlled zero-hallucination degradation if API or network is unavailable
        return this.handleSearchFailure(searchError, input, plan, startTime, actionsExecuted);
      }

      actionsExecuted.push({
        tool: 'execute_web_search',
        arguments: {
          query: plan.primaryQuery,
          depth: plan.searchDepth,
          fromCache: !!searchRes.fromCache,
        },
        result: {
          resultsCount: searchRes.results?.length || 0,
          fromCache: !!searchRes.fromCache,
          engine: 'tavily_search',
        },
        latencyMs: Date.now() - searchStartTime,
        success: true,
      });

      // 3. PIPELINE STEP 4 & 5: Source Extraction & Source Validation
      const validSources = searchRes.results || [];
      actionsExecuted.push({
        tool: 'validate_sources',
        arguments: { totalRetrieved: validSources.length },
        result: {
          validCount: validSources.length,
          officialSourcesCount: validSources.filter((s) => s.isOfficial).length,
          domains: Array.from(new Set(validSources.map((s) => s.domain).filter(Boolean))),
        },
        latencyMs: 10,
        success: true,
      });

      // 4. PIPELINE STEP 6 & 7: AI Analysis & Answer Generation with 3-Tier Fact Taxonomy
      const contextPrompt = WebSearchService.formatSearchResultsForLLM(searchRes);

      const systemPrompt = `Tu es le sous-agent JARVIS Research & Web Grounding (Phase 8).
Ta mission est d'effectuer une analyse de haute précision, rigoureusement documentée et exempte de toute hallucination.

RÈGLE D'OR : ZÉRO INVENTION DE FAITS.
Tu dois TOUJOURS structurer ta réponse selon le schéma suivant :

# 🌐 Synthèse de Recherche JARVIS

### 📌 Information trouvée
*(Les faits, chiffres précis, spécifications techniques, dates et citations directement prouvés par les sources. Référence chaque point avec [1], [2], etc.)*

### 💡 Information déduite
*(Les analyses comparatives logiques, recoupements, tendances ou extrapolations raisonnables basées sur les faits précédents.)*

### ❓ Information inconnue
*(Les informations non mentionnées dans les sources, les zones d'ombre, les données confidentielles ou non publiées à ce jour.)*

### 📚 Sources consultées
*(Liste claire des sources avec titre, domaine et pertinence).*

Adapte le ton : direct, précis, technologique et professionnel.`;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Requête utilisateur: "${input.query}"\n\nPlan de recherche exécuté: ${plan.rationale}\n\n${contextPrompt}`,
        },
      ];

      let reply = '';
      const onChunk = (chunk: string) => {
        reply += chunk;
        if (input.onChunk) input.onChunk(chunk);
      };

      const result = await JarvisAiRouter.executeStream({
        messages,
        systemPrompt,
        model: input.modelOverride,
        temperature: 0.25, // Lower temperature for factual fidelity
        timeoutMs: input.timeoutMs || 30000,
        onChunk,
      });

      // Build spoken summary for voice HUD
      const cleanSummary = reply
        .replace(/[#*`_]/g, '')
        .replace(/Information trouvée|Information déduite|Information inconnue|Sources consultées/gi, '')
        .trim();
      const firstSentence = cleanSummary.split('\n')[0] || cleanSummary.slice(0, 150);
      const spokenSummary = firstSentence.length > 180 ? firstSentence.slice(0, 180) + '...' : firstSentence;

      return {
        id: `out_research_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: true,
        actionsExecuted,
        structuredData: {
          category: plan.category,
          query: plan.primaryQuery,
          sourcesCount: validSources.length,
          fromCache: !!searchRes.fromCache,
          sources: validSources.map((s, i) => ({
            id: i + 1,
            title: s.title,
            url: s.url,
            domain: s.domain,
            trustTier: s.trustTier,
          })),
        },
        telemetry: {
          providerUsed: result.providerUsed,
          modelUsed: result.modelUsed,
          fallbackOccurred: result.attempts.length > 1,
          providerChainAttempted: result.attempts.map((a) => a.provider),
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Compare avec un autre modèle',
          'Enregistre cette synthèse dans ma mémoire',
          'Rédige un rapport détaillé au format PDF',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime, actionsExecuted);
    }
  }

  /**
   * Controlled handling when search fails without inventing false facts
   */
  private handleSearchFailure(
    searchError: any,
    input: AgentInput,
    plan: SearchPlan,
    startTime: number,
    actionsExecuted: any[]
  ): AgentOutput {
    const errorMsg = searchError?.message || 'Erreur réseau';
    const isApiKeyMissing = errorMsg.includes('TAVILY_API_KEY') || errorMsg.includes('not configured');
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('Quota');

    actionsExecuted.push({
      tool: 'execute_web_search',
      arguments: { query: plan.primaryQuery },
      result: { error: errorMsg },
      latencyMs: Date.now() - startTime,
      success: false,
    });

    let explanation = `### ⚠️ Statut de la Recherche Web\n\nImpossible de compléter l'interrogation du web en temps réel.\n\n`;
    if (isApiKeyMissing) {
      explanation += `**Cause :** La clé d'API Tavily (\`TAVILY_API_KEY\`) n'est pas configurée dans l'environnement du serveur.\n**Action suggérée :** Renseignez votre clé Tavily dans le fichier \`.env\` ou les paramètres d'environnement pour activer les recherches en temps réel.`;
    } else if (isRateLimit) {
      explanation += `**Cause :** Quota de requêtes Tavily dépassé (Erreur 429).\n**Action suggérée :** Patientez quelques instants ou passez à un forfait supérieur.`;
    } else {
      explanation += `**Cause :** ${errorMsg}.\n**Action suggérée :** Vérifiez la connexion réseau et réessayez.`;
    }

    explanation += `\n\n### ❓ Information inconnue\n- Données en direct pour la requête: "${input.query}" (non vérifiables hors ligne sans halluciner).`;

    return {
      id: `err_research_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: explanation,
      spokenSummary: isApiKeyMissing ? "La clé de recherche Tavily n'est pas configurée." : "Erreur de connexion lors de la recherche web.",
      actionsExecuted,
      telemetry: {
        providerUsed: 'local_fallback',
        modelUsed: 'none',
        fallbackOccurred: true,
        providerChainAttempted: ['tavily'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: isApiKeyMissing ? 'TAVILY_KEY_MISSING' : isRateLimit ? 'RATE_LIMIT_EXCEEDED' : 'NETWORK_ERROR',
        message: redactSecrets(errorMsg),
        recoverable: true,
        suggestedAction: isApiKeyMissing ? 'Configurez TAVILY_API_KEY' : 'Réessayez ultérieurement',
      },
    };
  }

  public handleError(error: any, input: AgentInput, startTime: number, actionsExecuted: any[] = []): AgentOutput {
    return {
      id: `err_research_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `### ❌ Erreur lors de l'investigation\n\nImpossible de traiter la demande de recherche : ${redactSecrets(error?.message || String(error))}`,
      spokenSummary: 'Erreur lors de la recherche en ligne.',
      actionsExecuted,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'RESEARCH_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez les paramètres réseau ou formulez une requête simplifiée.',
      },
    };
  }
}

