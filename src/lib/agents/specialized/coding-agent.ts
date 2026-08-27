/**
 * CODING AGENT (Specialized Agent — Phase 9)
 * 
 * Connected to GitHub when GITHUB_TOKEN is available.
 * 
 * Capabilities:
 * - Analyser un dépôt (structure, étoiles, commits, branches, technologies)
 * - Lire des fichiers (contenu brut, arborescences, code source)
 * - Rechercher des erreurs (bugs logiques, failles de sécurité, régressions)
 * - Expliquer du code (décomposition algorithmique, architecture, complexité)
 * - Analyser les dépendances (package.json, gradle, manifests)
 * - Analyser les issues (classification bugs, features, sécurité)
 * - Préparer des corrections (génération de diffs et patchs ciblés)
 * - Créer une issue lorsque l'utilisateur l'autorise (gated by confirmation token)
 * 
 * Strict Permissions Model:
 * - Lecture autorisée par défaut (Safe / Pas de confirmation)
 * - Modification : confirmation obligatoire
 * - Commit : confirmation obligatoire
 * - Push : confirmation obligatoire
 * - Suppression : confirmation obligatoire
 * - Création d'issue : confirmation obligatoire
 * - GITHUB_TOKEN JAMAIS exposé dans l'APK ou au client (server-side only)
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
import {
  GitHubService,
  GITHUB_PERMISSION_RULES,
  GitHubOperationType,
  PendingConfirmationRequest,
} from '../../services/github-service.js';

export class CodingAgent implements SpecializedAgent {
  public readonly id: AgentId = 'coding';
  public readonly name = 'JARVIS Coding & GitHub Agent';
  public readonly description = 'Ingénieur logiciel et assistant GitHub : analyse de dépôts, lecture de fichiers, détection d’erreurs, explications de code, dépendances et patchs sécurisés.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'repo_analysis',
      name: 'Analyse de Dépôt GitHub',
      description: 'Inspection complète de l’architecture, des commits récents, des branches et des technologies d’un projet.',
      tags: ['analyse le dépôt', 'analyse le repo', 'github', 'architecture', 'structure', 'projet'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'file_inspection',
      name: 'Lecture & Inspection de Fichiers',
      description: 'Consultation sécurisée du code source et de l’arborescence des fichiers d’un projet.',
      tags: ['lis le fichier', 'affiche le code', 'ouvre le fichier', 'contenu du fichier', 'arborescence'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'bug_hunting',
      name: 'Recherche d’Erreurs & Vulnérabilités',
      description: 'Détection de bugs, fuites de mémoire, failles de sécurité, crashs et erreurs de syntaxe.',
      tags: ['cherche des erreurs', 'debug', 'erreur', 'bug', 'faille', 'crash', 'stacktrace', 'analyse le bug'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'code_explanation',
      name: 'Explication & Documentation de Code',
      description: 'Explication détaillée pas-à-pas de scripts, algorithmes, design patterns et complexité temporelle.',
      tags: ['explique ce code', 'comment marche', 'explique la fonction', 'documentation', 'complexité'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'dependency_audit',
      name: 'Analyse des Dépendances',
      description: 'Audit des packages (package.json, build.gradle.kts), détection des versions obsolètes et frameworks.',
      tags: ['analyse les dépendances', 'dépendances', 'packages', 'gradle', 'npm', 'bibliothèques'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'issue_management',
      name: 'Analyse & Gestion des Issues',
      description: 'Revue des tickets GitHub, classification par gravité et préparation de résolutions.',
      tags: ['analyse les issues', 'tickets', 'problèmes github', 'bugs signalés', 'issues ouvertes'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'patch_preparation',
      name: 'Préparation de Corrections & Diff',
      description: 'Élaboration de correctifs chirurgicaux et propositions de patchs prêts à intégrer.',
      tags: ['prépare une correction', 'corrige le code', 'propose un patch', 'fix', 'refactoring'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'issue_creation_gated',
      name: 'Création d’Issue avec Confirmation',
      description: 'Publication contrôlée d’une issue GitHub après consentement explicite de l’utilisateur.',
      tags: ['crée une issue', 'ouvre un ticket', 'signale le bug sur github', 'post issue'],
      requiredPermissions: ['user_confirmation'],
      riskLevel: 'medium',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'analyze_repository',
      description: 'Récupère les métadonnées et la vue d’ensemble d’un dépôt GitHub.',
      parameters: { repo: { type: 'string' } },
    },
    {
      name: 'read_file_content',
      description: 'Lit le contenu d’un fichier source ou d’un dossier GitHub.',
      parameters: { repo: { type: 'string' }, path: { type: 'string' } },
    },
    {
      name: 'audit_dependencies',
      description: 'Scanne les manifestes de dépendances (npm, gradle, python).',
      parameters: { repo: { type: 'string' } },
    },
    {
      name: 'fetch_issues',
      description: 'Liste et catégorise les issues ouvertes/fermées.',
      parameters: { repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } },
    },
    {
      name: 'request_action_confirmation',
      description: 'Sollicite l’autorisation explicite de l’utilisateur pour une opération mutante (modification, commit, push, suppression, issue).',
      parameters: { operation: { type: 'string' }, summary: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    let score = 0.05;
    const matches: string[] = [];

    // Phase 9 Dedicated Commands
    if (q.includes('analyse le dépôt') || q.includes('analyse ce dépôt') || q.includes('analyse le repo') || q.includes('dépôt github')) {
      score += 0.92;
      matches.push('repo_analysis');
    }
    if (q.includes('lis le fichier') || q.includes('lire le fichier') || q.includes('affiche le code') || q.includes('regarde le fichier')) {
      score += 0.90;
      matches.push('file_inspection');
    }
    if (q.includes('recherche des erreurs') || q.includes('cherche des erreurs') || q.includes('trouve le bug') || q.includes('débogue') || q.includes('debug')) {
      score += 0.92;
      matches.push('bug_hunting');
    }
    if (q.includes('explique ce code') || q.includes('explique le code') || q.includes('comment fonctionne ce code') || q.includes('explication du code')) {
      score += 0.92;
      matches.push('code_explanation');
    }
    if (q.includes('analyse les dépendances') || q.includes('dépendances') || q.includes('audit npm') || q.includes('gradle')) {
      score += 0.90;
      matches.push('dependency_audit');
    }
    if (q.includes('analyse les issues') || q.includes('issues github') || q.includes('tickets ouverts') || q.includes('liste les issues')) {
      score += 0.90;
      matches.push('issue_management');
    }
    if (q.includes('prépare une correction') || q.includes('prépare un correctif') || q.includes('propose un patch') || q.includes('corrige ce code')) {
      score += 0.90;
      matches.push('patch_preparation');
    }
    if (q.includes('crée une issue') || q.includes('créer une issue') || q.includes('ouvre une issue') || q.includes('signale ce problème sur github')) {
      score += 0.95;
      matches.push('issue_creation_gated');
    }

    // General Coding keywords
    const codingKeywords = [
      'code', 'fonction', 'typescript', 'javascript', 'python', 'kotlin',
      'react', 'syntaxe', 'api', 'commit', 'git', 'refactor', 'compilation',
    ];

    for (const kw of codingKeywords) {
      if (q.includes(kw)) {
        score += 0.35;
        if (!matches.includes('code_explanation')) matches.push('code_explanation');
      }
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.6 ? 0.95 : score > 0.3 ? 0.75 : 0.2,
      reason: matches.length > 0
        ? `Demande d’ingénierie logicielle / GitHub détectée (${matches.join(', ')})`
        : 'Pas d’intention logicielle directe.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: matches.includes('issue_creation_gated') ? ['user_confirmation'] : [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const actionsExecuted: AgentOutput['actionsExecuted'] = [];
    const q = input.query.toLowerCase().trim();

    try {
      const target = GitHubService.parseRepoTarget(input.query);

      // --- COMMAND 1: Analyser un dépôt ---
      if (q.includes('analyse') && (q.includes('dépôt') || q.includes('repo') || q.includes('projet'))) {
        return await this.handleRepoAnalysis(target.owner, target.repo, input, startTime, actionsExecuted);
      }

      // --- COMMAND 2: Lire des fichiers ---
      if (q.includes('lis le fichier') || q.includes('lire le fichier') || q.includes('affiche le code') || q.includes('ouvre le fichier')) {
        return await this.handleFileRead(target.owner, target.repo, input, startTime, actionsExecuted);
      }

      // --- COMMAND 3: Analyser les dépendances ---
      if (q.includes('dépendance') || q.includes('packages') || q.includes('gradle') || q.includes('npm')) {
        return await this.handleDependenciesAnalysis(target.owner, target.repo, input, startTime, actionsExecuted);
      }

      // --- COMMAND 4: Analyser les issues ---
      if (q.includes('issue') || q.includes('ticket')) {
        return await this.handleIssuesAnalysis(target.owner, target.repo, input, startTime, actionsExecuted);
      }

      // --- COMMAND 5: Créer une issue (Gated by confirmation) ---
      if (q.includes('crée une issue') || q.includes('créer une issue') || q.includes('ouvre une issue') || q.includes('post issue')) {
        return await this.handleIssueCreationRequest(target.owner, target.repo, input, startTime, actionsExecuted);
      }

      // --- COMMAND 6: Rechercher des erreurs / Expliquer du code / Préparer des corrections (Général) ---
      return await this.handleGeneralCodeTask(input, startTime, actionsExecuted);
    } catch (err: any) {
      return this.handleError(err, input, startTime, actionsExecuted);
    }
  }

  /**
   * 1. Handler: Analyse de dépôt
   */
  private async handleRepoAnalysis(
    owner: string,
    repo: string,
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    const repoSummary = await GitHubService.analyzeRepository(owner, repo);
    actionsExecuted.push({
      tool: 'analyze_repository',
      arguments: { owner, repo },
      result: {
        stars: repoSummary.starsCount,
        forks: repoSummary.forksCount,
        openIssues: repoSummary.openIssuesCount,
        language: repoSummary.language,
      },
      latencyMs: 120,
      success: true,
    });

    const depSummary = await GitHubService.analyzeDependencies(owner, repo).catch(() => null);
    if (depSummary) {
      actionsExecuted.push({
        tool: 'audit_dependencies',
        arguments: { owner, repo },
        result: { frameworks: depSummary.frameworksDetected, count: depSummary.dependenciesCount },
        latencyMs: 80,
        success: true,
      });
    }

    const systemPrompt = `Tu es l'agent JARVIS Coding (Phase 9).
Fournis une analyse technique de haut niveau du dépôt GitHub ${owner}/${repo}.
Mets en valeur :
1. 🏗️ Architecture & Rôle du projet
2. ⚡ Stack technique & Langages détectés
3. 📦 Dépendances majeures et frameworks
4. 📈 État de santé (Commits récents, étoiles, issues)
5. 🛡️ Statut des permissions : Lecture autorisée par défaut.
Reste concis, structuré et rigoureux.`;

    const context = `Détails du dépôt:\n${JSON.stringify(repoSummary, null, 2)}\n\nDépendances:\n${JSON.stringify(depSummary, null, 2)}`;

    const { reply, telemetry } = await this.synthesizeWithAi(input, systemPrompt, context, startTime);

    return {
      id: `out_code_repo_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: `Analyse du dépôt ${owner}/${repo} terminée. Stack principale : ${repoSummary.language}.`,
      actionTaken: true,
      actionsExecuted,
      structuredData: {
        type: 'repository_analysis',
        repo: `${owner}/${repo}`,
        summary: repoSummary,
        dependencies: depSummary,
        permissions: {
          read: 'autorisé_par_défaut',
          modification: 'confirmation_requise',
          commit: 'confirmation_requise',
          push: 'confirmation_requise',
          deletion: 'confirmation_requise',
        },
      },
      telemetry,
      nextSuggestions: [
        `Lis le fichier README.md de ${repo}`,
        `Analyse les dépendances de ${repo}`,
        `Recherche les erreurs dans le code`,
      ],
    };
  }

  /**
   * 2. Handler: Lecture de fichier
   */
  private async handleFileRead(
    owner: string,
    repo: string,
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    // Extract path if specified, else default to README or package.json
    let filePath = '';
    const match = input.query.match(/fichier\s+([^\s]+)/i) || input.query.match(/path\s+([^\s]+)/i);
    if (match && match[1]) {
      filePath = match[1].replace(/['",]/g, '').trim();
    } else {
      filePath = 'README.md';
    }

    const fileResult = await GitHubService.readFile(owner, repo, filePath);
    actionsExecuted.push({
      tool: 'read_file_content',
      arguments: { owner, repo, path: filePath },
      result: { type: fileResult.type, size: fileResult.size, entriesCount: fileResult.entries?.length },
      latencyMs: 95,
      success: true,
    });

    let contentPreview = fileResult.content || '';
    if (fileResult.type === 'dir') {
      contentPreview = `Arborescence du dossier:\n` + (fileResult.entries || []).map((e) => `- [${e.type}] ${e.name}`).join('\n');
    }

    const systemPrompt = `Tu es l'agent JARVIS Coding.
L'utilisateur a demandé la lecture du fichier "${filePath}" sur le dépôt ${owner}/${repo}.
Explique le rôle de ce fichier, ses composants clés et sa pertinence dans l'architecture.`;

    const { reply, telemetry } = await this.synthesizeWithAi(input, systemPrompt, `Contenu de ${filePath}:\n${contentPreview.slice(0, 3000)}`, startTime);

    return {
      id: `out_code_file_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: `Fichier ${filePath} chargé et analysé avec succès.`,
      actionTaken: true,
      actionsExecuted,
      structuredData: {
        type: 'file_read',
        filePath,
        fileType: fileResult.type,
        size: fileResult.size,
      },
      telemetry,
      nextSuggestions: [
        `Recherche des erreurs dans ${filePath}`,
        `Explique la logique de ce fichier`,
        `Prépare une correction pour ${filePath}`,
      ],
    };
  }

  /**
   * 3. Handler: Analyse des dépendances
   */
  private async handleDependenciesAnalysis(
    owner: string,
    repo: string,
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    const depAnalysis = await GitHubService.analyzeDependencies(owner, repo);
    actionsExecuted.push({
      tool: 'audit_dependencies',
      arguments: { owner, repo },
      result: { count: depAnalysis.dependenciesCount, manifest: depAnalysis.manifestType },
      latencyMs: 110,
      success: true,
    });

    const systemPrompt = `Tu es l'agent JARVIS Coding.
Effectue un audit rigoureux des dépendances du projet ${owner}/${repo} (${depAnalysis.manifestType}).
Indique :
- Les frameworks clés identifiés
- Les bibliothèques lourdes ou critiques
- Les recommandations de sécurité ou de modernisation.`;

    const { reply, telemetry } = await this.synthesizeWithAi(input, systemPrompt, JSON.stringify(depAnalysis, null, 2), startTime);

    return {
      id: `out_code_deps_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: `Audit des dépendances terminé : ${depAnalysis.dependenciesCount} packages analysés.`,
      actionTaken: true,
      actionsExecuted,
      structuredData: depAnalysis,
      telemetry,
      nextSuggestions: [
        'Vérifie la compatibilité des versions',
        'Recherche les failles de sécurité',
      ],
    };
  }

  /**
   * 4. Handler: Analyse des issues
   */
  private async handleIssuesAnalysis(
    owner: string,
    repo: string,
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    const issues = await GitHubService.listAndAnalyzeIssues(owner, repo, 'open', 10);
    actionsExecuted.push({
      tool: 'fetch_issues',
      arguments: { owner, repo, state: 'open' },
      result: { count: issues.length },
      latencyMs: 130,
      success: true,
    });

    const systemPrompt = `Tu es l'agent JARVIS Coding.
Analyse la liste des issues ouvertes pour le projet ${owner}/${repo}.
Classe les tickets par criticité (Bugs bloquants, Améliorations, Sécurité) et propose un plan d'action de résolution prioritaire.`;

    const { reply, telemetry } = await this.synthesizeWithAi(input, systemPrompt, JSON.stringify(issues, null, 2), startTime);

    return {
      id: `out_code_issues_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: `${issues.length} issues analysées pour ${owner}/${repo}.`,
      actionTaken: true,
      actionsExecuted,
      structuredData: {
        issuesCount: issues.length,
        issues: issues.map((i) => ({ number: i.number, title: i.title, category: i.category, author: i.author })),
      },
      telemetry,
      nextSuggestions: [
        'Prépare un correctif pour la première issue',
        'Crée une issue pour signaler un nouveau problème',
      ],
    };
  }

  /**
   * 5. Handler: Création d'issue (Gated by Permission / Confirmation)
   */
  private async handleIssueCreationRequest(
    owner: string,
    repo: string,
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    const titleMatch = input.query.match(/titre[:\s]+["']?([^"'\n]+)["']?/i);
    const title = titleMatch ? titleMatch[1].trim() : `Rapport de diagnostic automatique JARVIS - ${new Date().toLocaleDateString('fr-FR')}`;
    const body = `### Description générée par JARVIS Coding Agent (Phase 9)\n\n**Requête utilisateur :** ${input.query}\n**Horodatage :** ${new Date().toISOString()}\n**Statut :** Soumis après confirmation de l'utilisateur.`;

    // Check confirmation token if passed in context/params
    const confirmationToken = (input.context as any)?.confirmationToken;

    if (!confirmationToken) {
      // Step A: Request confirmation
      const confirmationReq = GitHubService.createConfirmationRequest(
        'issue_create',
        owner,
        repo,
        `Création d'une issue publique sur GitHub : "${title}"`,
        { title, body, labels: ['jarvis-agent', 'diagnostic'] }
      );

      actionsExecuted.push({
        tool: 'request_action_confirmation',
        arguments: { operation: 'issue_create', owner, repo, title },
        result: { confirmationRequired: true, tokenId: confirmationReq.id },
        latencyMs: 10,
        success: true,
      });

      const reply = `### 🔒 Autorisation requise — Création d'Issue GitHub\n\n` +
        `Conformément au système de permissions de JARVIS, la création d'une issue publique sur **${owner}/${repo}** nécessite votre consentement explicite.\n\n` +
        `**Détails de l'issue à créer :**\n` +
        `- **Dépôt :** \`${owner}/${repo}\`\n` +
        `- **Titre :** *${title}*\n` +
        `- **Labels :** \`jarvis-agent\`, \`diagnostic\`\n` +
        `- **Token de confirmation :** \`${confirmationReq.id}\` (valide 10 min)\n\n` +
        `*Confirmez l'action pour publier l'issue sur GitHub.*`;

      return {
        id: `out_code_confirm_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply,
        spokenSummary: "Une confirmation est nécessaire pour créer cette issue sur GitHub.",
        actionTaken: false,
        actionsExecuted,
        structuredData: {
          requiresConfirmation: true,
          confirmationRequest: confirmationReq,
        },
        telemetry: {
          providerUsed: 'local',
          modelUsed: 'none',
          fallbackOccurred: false,
          providerChainAttempted: ['security_gate'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          `Confirmer la création de l'issue (${confirmationReq.id})`,
          'Annuler l’opération',
        ],
      };
    }

    // Step B: Confirmation provided -> execute creation
    const result = await GitHubService.createIssue(owner, repo, title, body, ['jarvis-agent'], confirmationToken);
    return {
      id: `out_code_issue_created_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: `### ✅ Issue GitHub créée avec succès\n\n- **Numéro :** #${result.issueNumber}\n- **Lien :** [Voir sur GitHub](${result.issueUrl})\n- **Dépôt :** ${owner}/${repo}`,
      spokenSummary: `Issue #${result.issueNumber} créée avec succès sur GitHub.`,
      actionTaken: true,
      actionsExecuted,
      telemetry: {
        providerUsed: 'github_rest_api',
        modelUsed: 'none',
        fallbackOccurred: false,
        providerChainAttempted: ['github_api'],
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 6. Handler: Tâche générale de code (explications, détection d'erreurs, patchs)
   */
  private async handleGeneralCodeTask(
    input: AgentInput,
    startTime: number,
    actionsExecuted: any[]
  ): Promise<AgentOutput> {
    const systemPrompt = `Tu es le sous-agent JARVIS Coding (Phase 9), expert en architecture système, TypeScript, Kotlin, Rust et GitHub.
Tu dois répondre aux requêtes de développement avec la plus haute rigueur :
- **Recherche d'erreurs** : Identifie les failles logiques, bugs de concurrence, erreurs de typage et vulnérabilités de sécurité.
- **Explication de code** : Décompose étape par étape l'algorithme, la complexité (Big-O) et les design patterns.
- **Préparation de corrections** : Fournis des diffs clairs, typés et commentés.

RAPPEL DES RÈGLES DE SÉCURITÉ GITHUB :
- Lecture : Autorisée par défaut.
- Modifications / Commits / Push / Suppressions / Création d'issues : Confirmation obligatoire requise.
- Ne JAMAIS exposer de clé GITHUB_TOKEN.`;

    const { reply, telemetry } = await this.synthesizeWithAi(input, systemPrompt, input.query, startTime);

    return {
      id: `out_code_general_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: 'Analyse et synthèse de code terminées, Monsieur.',
      actionTaken: true,
      actionsExecuted,
      telemetry,
      nextSuggestions: [
        'Génère les tests unitaires associés',
        'Prépare un patch de correction',
        'Vérifie la complexité algorithmique',
      ],
    };
  }

  /**
   * AI Stream synthesis helper
   */
  private async synthesizeWithAi(
    input: AgentInput,
    systemPrompt: string,
    userContent: string,
    startTime: number
  ): Promise<{ reply: string; telemetry: any }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
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
      temperature: 0.2,
      timeoutMs: input.timeoutMs || 30000,
      onChunk,
    });

    return {
      reply,
      telemetry: {
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
        fallbackOccurred: result.attempts.length > 1,
        providerChainAttempted: result.attempts.map((a) => a.provider),
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  public handleError(error: any, input: AgentInput, startTime: number, actionsExecuted: any[] = []): AgentOutput {
    return {
      id: `err_code_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `### ❌ Erreur Coding Agent\n\nImpossible de compléter l'opération logicielle : ${redactSecrets(error?.message || String(error))}`,
      spokenSummary: 'Erreur lors de l’analyse ou de l’opération de code.',
      actionsExecuted,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'CODING_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez les autorisations du dépôt ou le nom du fichier.',
      },
    };
  }
}

