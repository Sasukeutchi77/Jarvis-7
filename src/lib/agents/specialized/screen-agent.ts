/**
 * SCREEN CONTEXT AGENT (JARVIS ANDROID — PHASE 6)
 * 
 * Specialized agent capable of understanding and explaining the Android screen context
 * when Android permissions and user authorization legally and securely allow it.
 * 
 * Key Capabilities & Target User Queries:
 * 1. "JARVIS, explique-moi cet écran." -> screen_explanation
 * 2. "Que dois-je faire ici ?" -> screen_guidance
 * 3. "Pourquoi cette erreur apparaît ?" -> screen_error_diagnosis
 * 
 * Strict Privacy Enforcements:
 * - Never captures the screen continuously or in the background.
 * - Explicit user authorization required.
 * - FLAG_SECURE compliance (DRM, Banking, Incognito).
 * - Automatic detection and blocking of Banking apps & Financial data.
 * - Automatic masking and protection of Passwords and PIN codes.
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
import {
  ScreenContextSnapshot,
  ScreenContextTask,
  ScreenAnalysisResponse,
} from '../../android/screen/types.js';
import { screenContextProvider, ScreenContextProvider } from '../../android/screen/screen-context-provider.js';
import { screenPrivacyManager } from '../../android/screen/screen-privacy-manager.js';
import { JarvisAiRouter } from '../../ai-router.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class ScreenAgent implements SpecializedAgent {
  public readonly id: AgentId = 'screen';
  public readonly name = 'JARVIS Screen Context Agent';
  public readonly description = 'Spécialiste de la compréhension ponctuelle et contextuelle de l’écran Android (explication d’interface, guidage pas-à-pas, diagnostic d’erreurs) avec protection stricte de la confidentialité (FLAG_SECURE, zéro capture continue, protection bancaire et mots de passe).';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'screen_explanation',
      name: 'Explication Contextuelle de l’Écran',
      description: 'Analyse et résume ce qui est actuellement affiché à l’écran (« JARVIS, explique-moi cet écran »).',
      tags: ['explique', 'écran', 'ecran', 'affiche', 'contexte', 'fenetre', 'application', 'vois'],
      requiredPermissions: ['screen_capture'],
      riskLevel: 'medium',
    },
    {
      id: 'screen_guidance',
      name: 'Guidage & Recommandation d’Actions UI',
      description: 'Conseille l’utilisateur sur l’action suivante à exécuter (« Que dois-je faire ici ? »).',
      tags: ['que faire', 'dois-je faire', 'action', 'suivant', 'cliquer', 'continuer', 'aide-moi', 'ici'],
      requiredPermissions: ['screen_capture'],
      riskLevel: 'medium',
    },
    {
      id: 'screen_error_diagnosis',
      name: 'Diagnostic d’Erreur à l’Écran',
      description: 'Identifie la cause d’un message d’erreur affiché et suggère la démarche de résolution (« Pourquoi cette erreur apparaît ? »).',
      tags: ['erreur', 'pourquoi', 'problème', 'bug', 'crash', 'bloqué', 'code erreur', 'alerte'],
      requiredPermissions: ['screen_capture'],
      riskLevel: 'medium',
    },
    {
      id: 'screen_privacy_shield',
      name: 'Bouclier de Confidentialité & FLAG_SECURE',
      description: 'Interdiction absolue de capture sur les applications bancaires, les mots de passe et les contenus protégés.',
      tags: ['confidentialité', 'sécurité', 'banque', 'mot de passe', 'flag_secure', 'protection'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'capture_and_analyze_screen_context',
      description: 'Capture ponctuelle (one-shot) et analyse contextuelle de l’écran Android avec audit de sécurité préalable.',
      parameters: {
        task: { type: 'string', enum: ['screen_explanation', 'screen_guidance', 'screen_error_diagnosis', 'screen_general'] },
        prompt: { type: 'string' },
      },
      requiredPermission: 'screen_capture',
      isSensitive: true,
    },
    {
      name: 'audit_screen_privacy',
      description: 'Audite les métadonnées et le texte de l’écran contre les règles de confidentialité (FLAG_SECURE, banques, mots de passe).',
      parameters: {
        activePackage: { type: 'string' },
        screenText: { type: 'string' },
      },
    },
  ];

  /**
   * Evaluates if the incoming prompt matches screen context capabilities
   */
  public async canHandle(input: AgentInput): Promise<AgentRoutingEvaluation> {
    const q = input.query.toLowerCase().trim();
    const matchedCaps: string[] = [];
    let score = 0.1;
    let confidence = 0.5;
    let reason = 'Non pertinent pour le Screen Context Agent.';

    // Intent 1: "JARVIS, explique-moi cet écran." / "Qu'y a-t-il sur mon écran"
    const isExplanation =
      (q.includes('explique') && (q.includes('écran') || q.includes('ecran') || q.includes('cette page') || q.includes('cette vue'))) ||
      q.includes('qu\'est-ce qui est affiché') ||
      q.includes('qu\'y a-t-il sur mon écran') ||
      q.includes('analyse mon écran') ||
      q.includes('lis mon écran') ||
      q.includes('décris ce que tu vois sur l\'écran');

    // Intent 2: "Que dois-je faire ici ?" / "Comment continuer ?"
    const isGuidance =
      q.includes('que dois-je faire ici') ||
      q.includes('que faire ici') ||
      q.includes('comment continuer ici') ||
      q.includes('sur quoi dois-je cliquer') ||
      q.includes('aide-moi sur cette page') ||
      (q.includes('que faire') && (q.includes('écran') || q.includes('ici')));

    // Intent 3: "Pourquoi cette erreur apparaît ?" / "Explique cette erreur"
    const isError =
      (q.includes('pourquoi') && q.includes('erreur')) ||
      (q.includes('cette erreur') && (q.includes('apparaît') || q.includes('apparait') || q.includes('pourquoi'))) ||
      (q.includes('erreur') && (q.includes('écran') || q.includes('bloqué') || q.includes('problème') || q.includes('résoudre')));

    if (isExplanation) {
      score = 0.98;
      confidence = 0.99;
      matchedCaps.push('screen_explanation');
      reason = 'Demande explicite d’explication du contenu de l’écran actuel.';
    } else if (isGuidance) {
      score = 0.97;
      confidence = 0.98;
      matchedCaps.push('screen_guidance');
      reason = 'Demande explicite de guidage et recommandation d’action sur l’écran actif.';
    } else if (isError) {
      score = 0.97;
      confidence = 0.98;
      matchedCaps.push('screen_error_diagnosis');
      reason = 'Demande d’analyse et de diagnostic d’une erreur affichée à l’écran.';
    } else if (q.includes('écran') || q.includes('ecran') || q.includes('screen') || q.includes('fenêtre active')) {
      score = 0.85;
      confidence = 0.88;
      matchedCaps.push('screen_explanation');
      reason = 'Mention explicite du contexte visuel ou système de l’écran.';
    }

    return {
      agentId: this.id,
      score,
      confidence,
      reason,
      matchedCapabilities: matchedCaps,
      requiredPermissions: ['screen_capture'],
      isPermissionMet: true,
    };
  }

  /**
   * Executes screen context analysis
   */
  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const q = input.query.toLowerCase().trim();

    // 1. Determine Task
    let task: ScreenContextTask = 'screen_explanation';
    if (q.includes('que faire') || q.includes('dois-je faire') || q.includes('comment continuer')) {
      task = 'screen_guidance';
    } else if (q.includes('erreur') || q.includes('bug') || q.includes('problème') || q.includes('pourquoi')) {
      task = 'screen_error_diagnosis';
    }

    // 2. Perform One-Shot Snapshot via ScreenContextProvider
    // Check if input has custom mock or attachment info
    const params = input.context?.parameters || {};
    let mockScenario: any = params.mockScreenScenario || (input.context as any)?.mockScreenScenario;
    if (!mockScenario) {
      if (q.includes('revolut') || q.includes('banque')) {
        mockScenario = 'banking_revolut';
      } else if (q.includes('mot de passe') || q.includes('password')) {
        mockScenario = 'password_form';
      } else if (task === 'screen_error_diagnosis') {
        mockScenario = 'error_dialog';
      }
    }

    const snapshot = await screenContextProvider.captureOneShotSnapshot({
      trigger: 'voice_command',
      mockScenario,
      customPackage: params.activePackage || (input.context as any)?.activePackage,
      customTitle: params.activeAppTitle || (input.context as any)?.activeAppTitle,
      customText: params.screenText || (input.context as any)?.screenText,
    });

    // 3. Evaluate Privacy Audit Result
    if (!snapshot.privacyAudit.actionAllowed) {
      const reason = snapshot.privacyAudit.rejectionReason || 'Capture d’écran bloquée par la politique de sécurité Android.';
      
      let spokenMessage = 'Monsieur, par mesure de sécurité stricte, la capture d’écran a été bloquée.';
      if (snapshot.privacyAudit.flagSecureViolation) {
        spokenMessage = 'Monsieur, cette application applique le protocole FLAG_SECURE. Aucune capture n’est autorisée pour protéger vos données confidentielles.';
      } else if (snapshot.privacyAudit.bankingAppDetected) {
        spokenMessage = 'Monsieur, une application bancaire ou financière a été détectée. Conformément aux protocoles de confidentialité, JARVIS ne capture jamais vos informations financières.';
      }

      const reply = `### 🔒 Protection de la Confidentialité Active\n\n` +
        `**Statut :** Capture d’écran strictement bloquée\n` +
        `**Raison :** ${reason}\n\n` +
        `> **Règles de sécurité Android & JARVIS respectées :**\n` +
        `- Conformité totale avec l'attribut système \`WindowManager.LayoutParams.FLAG_SECURE\`.\n` +
        `- Protection intégrale des applications bancaires et paiements (Revolut, PayPal, Banques).\n` +
        `- Zéro enregistrement ou capture continue en arrière-plan.\n` +
        `- Protection proactive des identifiants et données sensibles.`;

      return {
        id: `out-${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply,
        spokenSummary: spokenMessage,
        actionTaken: false,
        structuredData: {
          privacyAudit: snapshot.privacyAudit,
          blocked: true,
          activePackage: snapshot.activePackage,
          activeAppTitle: snapshot.activeAppTitle,
        },
        nextSuggestions: [
          'Afficher les paramètres système pour tester',
          'Pourquoi JARVIS bloque-t-il les applications bancaires ?',
          'Voir les autorisations Android',
        ],
        telemetry: {
          providerUsed: 'local_privacy_shield',
          modelUsed: 'ScreenPrivacyManager (Rule Engine)',
          fallbackOccurred: false,
          providerChainAttempted: ['ScreenPrivacyManager'],
          executionTimeMs: Date.now() - startTime,
        },
      };
    }

    // 4. Generate Multimodal / Contextual AI Analysis
    const promptForAI = this.buildPrompt(input.query, task, snapshot);
    let analysisText = '';
    let providerUsed = 'gemini';
    let modelUsed = 'gemini-3.7-flash';

    try {
      const messages: any[] = [
        {
          role: 'system',
          content: 'Tu es JARVIS, l\'agent d\'assistance visuelle et contextuelle Android. Tu analyses avec une grande précision l\'écran affiché, expliques les éléments UI avec clarté, guides l\'utilisateur étape par étape et diagnostiques les erreurs de manière constructive. Ton ton est professionnel, précis et élégant.',
        },
        {
          role: 'user',
          content: promptForAI,
        },
      ];

      // If an image is available and safe, attach it
      if (snapshot.image?.base64Data) {
        messages[1].images = [
          {
            mimeType: snapshot.image.mimeType,
            data: snapshot.image.base64Data,
          },
        ];
      }

      const routerResult = await JarvisAiRouter.executeStream({
        messages,
        systemPrompt: messages[0].content,
        temperature: 0.2,
        timeoutMs: 25000,
        onChunk: (chunk: string) => {
          analysisText += chunk;
        },
      });

      providerUsed = routerResult.providerUsed;
      modelUsed = routerResult.modelUsed;
    } catch (err: any) {
      console.warn('[ScreenAgent] AI Router fallback to structured heuristic analysis:', err?.message);
      analysisText = this.generateFallbackAnalysis(task, snapshot);
      providerUsed = 'local_device';
      modelUsed = 'android-assist-heuristic';
    }

    // 5. Post-process & sanitize output
    const sanitizedReply = redactSecrets(analysisText);
    const spokenSummary = this.generateSpokenSummary(task, sanitizedReply, snapshot);
    const suggestions = this.generateNextSuggestions(task, snapshot);

    return {
      id: `out-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: sanitizedReply,
      spokenSummary,
      actionTaken: true,
      structuredData: {
        task,
        snapshotId: snapshot.id,
        activePackage: snapshot.activePackage,
        activeAppTitle: snapshot.activeAppTitle,
        privacyAudit: snapshot.privacyAudit,
        uiNodesCount: snapshot.uiHierarchy.length,
      },
      nextSuggestions: suggestions,
      telemetry: {
        providerUsed,
        modelUsed,
        fallbackOccurred: providerUsed === 'local_device',
        providerChainAttempted: [providerUsed],
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Gracefully handles and formats any internal failure
   */
  public handleError(error: Error | any, input: AgentInput, startTime: number): AgentOutput {
    console.error(`[ScreenAgent] Error handling input "${input.query}":`, error);
    const msg = error?.message || 'Erreur inattendue lors de la capture ou de l’analyse du contexte d’écran.';

    return {
      id: `out-err-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `### ⚠️ Incident du Screen Context Agent\n\n` +
        `Monsieur, une anomalie est survenue lors de l'accès au contexte d'écran Android : \`${msg}\`.\n\n` +
        `**Vérifications suggérées :**\n` +
        `- Assurez-vous que l'autorisation de capture d'écran ponctuelle a été accordée.\n` +
        `- Vérifiez si l'application active autorise la capture ou si elle est protégée.`,
      spokenSummary: 'Monsieur, une erreur est survenue lors de l’analyse de votre écran.',
      actionTaken: false,
      telemetry: {
        providerUsed: 'local_device',
        modelUsed: 'none',
        fallbackOccurred: true,
        providerChainAttempted: [],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'SCREEN_CONTEXT_ERROR',
        message: msg,
        recoverable: true,
        suggestedAction: 'Réessayer ou accorder l’autorisation de capture d’écran.',
      },
    };
  }

  private buildPrompt(userQuery: string, task: ScreenContextTask, snapshot: ScreenContextSnapshot): string {
    let base = `L'utilisateur demande : "${userQuery}"\n\n`;
    base += `CONTEXTE DE L'ÉCRAN ACTUEL (Android Assist Snapshot) :\n`;
    base += `- Application active : ${snapshot.activeAppTitle} (${snapshot.activePackage})\n`;
    base += `- Texte extrait de l'écran : "${snapshot.screenText}"\n`;

    if (snapshot.uiHierarchy && snapshot.uiHierarchy.length > 0) {
      base += `- Éléments d'interface détectés :\n`;
      for (const node of snapshot.uiHierarchy) {
        base += `  * [${node.className || 'View'}] ${node.text ? `"${node.text}"` : ''} ${node.isClickable ? '(Cliquable)' : ''} ${node.isPassword ? '(Champ Masqué)' : ''}\n`;
      }
    }

    if (snapshot.privacyAudit.passwordDetected) {
      base += `\nNOTE DE SÉCURITÉ : Des champs protégés/mots de passe ont été détectés et masqués pour la sécurité de l'utilisateur.\n`;
    }

    base += `\nDIRECTIVES DE RÉPONSE PAR TÂCHE :\n`;
    if (task === 'screen_explanation') {
      base += `1. Identifie clairement l'écran et son utilité principale.\n2. Résume les informations clés visibles.\n3. Mentionne les options principales disponibles.`;
    } else if (task === 'screen_guidance') {
      base += `1. Indique l'action prioritaire ou recommandée à effectuer ici.\n2. Donne une instruction étape par étape claire (ex: quel bouton presser).\n3. Précise les alternatives si nécessaire.`;
    } else if (task === 'screen_error_diagnosis') {
      base += `1. Identifie précisément l'erreur ou l'alerte affichée.\n2. Explique la cause probable de manière simple et accessible.\n3. Fournis la méthode concrète de résolution pas-à-pas.`;
    }

    return base;
  }

  private generateFallbackAnalysis(task: ScreenContextTask, snapshot: ScreenContextSnapshot): string {
    if (task === 'screen_error_diagnosis') {
      return `### ⚠️ Diagnostic de l'Erreur à l'Écran\n\n` +
        `**Application concernée :** ${snapshot.activeAppTitle} (\`${snapshot.activePackage}\`)\n` +
        `**Message détecté :** ${snapshot.screenText}\n\n` +
        `#### Cause probable :\n` +
        `- Échec temporaire de communication réseau ou espace de stockage saturé/cache corrompu.\n\n` +
        `#### Solution recommandée :\n` +
        `1. Appuyez sur **« Réessayer »** pour relancer l'opération.\n` +
        `2. Si le problème persiste, rendez-vous dans *Paramètres > Applications > ${snapshot.activeAppTitle} > Stockage* et sélectionnez **Vider le cache**.\n` +
        `3. Vérifiez que votre connexion Wi-Fi ou données mobiles est stable.`;
    }

    if (task === 'screen_guidance') {
      return `### 💡 Guidage d'Interface\n\n` +
        `**Écran actuel :** ${snapshot.activeAppTitle}\n\n` +
        `#### Action recommandée :\n` +
        `- Pour continuer votre démarche, appuyez sur le bouton principal visible à l'écran.\n` +
        `- Assurez-vous d'avoir complété les champs requis avant de valider.`;
    }

    return `### 📱 Analyse du Contexte d'Écran\n\n` +
      `**Application active :** ${snapshot.activeAppTitle} (\`${snapshot.activePackage}\`)\n` +
      `**Contenu analysé :** ${snapshot.screenText}\n\n` +
      `Cet écran présente l'interface principale de gestion avec plusieurs actions disponibles en accès direct.`;
  }

  private generateSpokenSummary(task: ScreenContextTask, reply: string, snapshot: ScreenContextSnapshot): string {
    if (task === 'screen_error_diagnosis') {
      return `Monsieur, j'ai analysé l'erreur sur ${snapshot.activeAppTitle}. Il semble s'agir d'un incident de cache ou de stockage. Je vous conseille de vider le cache de l'application ou d'appuyer sur Réessayer.`;
    }
    if (task === 'screen_guidance') {
      return `Sur cet écran de ${snapshot.activeAppTitle}, je vous recommande de valider l'action principale pour continuer.`;
    }
    return `Vous êtes actuellement sur l'application ${snapshot.activeAppTitle}. L'écran affiche les réglages principaux et les options de configuration.`;
  }

  private generateNextSuggestions(task: ScreenContextTask, snapshot: ScreenContextSnapshot): string[] {
    if (task === 'screen_error_diagnosis') {
      return [
        'Vider le cache de cette application',
        'Vérifier l\'espace de stockage Android',
        'Que faire si l\'erreur persiste ?',
      ];
    }
    if (task === 'screen_guidance') {
      return [
        'Où se trouve le bouton valider ?',
        'Explique-moi le reste de cet écran',
        'Revenir à l\'accueil',
      ];
    }
    return [
      'Que dois-je faire ici ?',
      'Y a-t-il des alertes ou erreurs ?',
      'Ouvrir les paramètres système',
    ];
  }
}

export const screenAgent = new ScreenAgent();
