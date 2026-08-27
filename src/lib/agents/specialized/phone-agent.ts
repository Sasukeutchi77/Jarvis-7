/**
 * PHONE AGENT (Phase 10: Phone Agent)
 * 
 * Specialized Autonomous Agent for Android Telephony:
 * - "Appelle Sarah."
 * - "Appelle le dernier appel manqué."
 * - "Qui m'a appelé ?"
 * - "Montre mes appels récents."
 * 
 * Integrates:
 * - CallManager (Call logs, missed calls, caller synthesis, intent execution)
 * - ContactResolver (ContactsContract, homonyms, multi-numbers, E.164 normalization)
 * - CallPermissionManager (Real Android telephony permissions, zero-bypass policy)
 * 
 * Handles:
 * 1. Contact inexistant
 * 2. Plusieurs contacts identiques (Disambiguation)
 * 3. Permission refusée (Graceful explanation & settings prompt)
 * 4. Numéro invalide (Validation & normalization advice)
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
import { CallPermissionManager } from '../../services/phone/call-permission-manager.js';
import { ContactResolver } from '../../services/phone/contact-resolver.js';
import { CallManager } from '../../services/phone/call-manager.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class PhoneAgent implements SpecializedAgent {
  public readonly id: AgentId = 'phone';
  public readonly name = 'JARVIS Phone & Calling Agent';
  public readonly description =
    'Agent autonome Android spécialisé dans les appels vocaux, consultation du journal d’appels, résolution des contacts et gestion des permissions téléphoniques.';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'place_phone_call',
      name: 'Passer un Appel Téléphonique',
      description: 'Lancement sécurisé d’appels vocaux vers un contact ou un numéro avec confirmation.',
      tags: ['appelle', 'téléphone à', 'numéro', 'appel', 'joindre', 'composer', 'coup de fil'],
      requiredPermissions: ['android.permission.CALL_PHONE'],
      riskLevel: 'medium',
    },
    {
      id: 'call_last_missed',
      name: 'Rappeler le Dernier Appel Manqué',
      description: 'Détection du dernier appelant manqué et préparation de l’appel en retour.',
      tags: ['dernier appel manqué', 'rappelle le dernier', 'rappeler appel manqué', 'qui a raccroché'],
      requiredPermissions: ['android.permission.READ_CALL_LOG'],
      riskLevel: 'medium',
    },
    {
      id: 'who_called_me',
      name: 'Identifier les Appelants Récents',
      description: 'Analyse et synthèse des appels récents et personnes ayant tenté de vous joindre.',
      tags: ['qui m’a appelé', 'qui ma appele', 'qui a appelé', 'derniers appels', 'qui a essayé de me joindre'],
      requiredPermissions: ['android.permission.READ_CALL_LOG'],
      riskLevel: 'low',
    },
    {
      id: 'show_recent_calls',
      name: 'Historique des Appels Récents',
      description: 'Affichage chronologique du journal d’appels Android (entrants, sortants, manqués).',
      tags: ['montre mes appels récents', 'journal d’appels', 'historique appels', 'appels récents'],
      requiredPermissions: ['android.permission.READ_CALL_LOG'],
      riskLevel: 'low',
    },
    {
      id: 'contact_lookup',
      name: 'Recherche & Désambiguïsation de Contacts',
      description: 'Résolution intelligente des correspondants et gestion des homonymes.',
      tags: ['numéro de', 'contact', 'répertoire', 'trouve le numéro', 'annuaire'],
      requiredPermissions: ['android.permission.READ_CONTACTS'],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'prepare_phone_call',
      description: 'Résout le contact, vérifie les autorisations et prépare un appel avec jeton de sécurité.',
      parameters: { target: { type: 'string' }, lastMissed: { type: 'boolean' } },
    },
    {
      name: 'initiate_phone_call',
      description: 'Exécute l’appel téléphonique via Intent Android après confirmation.',
      parameters: { confirmationToken: { type: 'string' } },
    },
    {
      name: 'query_recent_calls',
      description: 'Récupère la liste des derniers appels enregistrés sur l’appareil.',
      parameters: { limit: { type: 'number' } },
    },
    {
      name: 'who_called_me',
      description: 'Synthétise qui a tenté de vous appeler récemment.',
      parameters: { hoursWindow: { type: 'number' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();

    const patterns = [
      { regex: /appelle|téléphone à|passe un coup de fil|compose/i, cap: 'place_phone_call', weight: 0.85 },
      { regex: /dernier appel manqu|rappelle.*manqu/i, cap: 'call_last_missed', weight: 0.95 },
      { regex: /qui m['’]?a appel|qui a tent.*joindre|qui a appel/i, cap: 'who_called_me', weight: 0.95 },
      { regex: /montre.*appels?|historique.*appels?|journal.*appels?|appels récents/i, cap: 'show_recent_calls', weight: 0.95 },
      { regex: /numéro de|contact de|répertoire/i, cap: 'contact_lookup', weight: 0.75 },
    ];

    let maxScore = 0.05;
    const matches: string[] = [];

    for (const p of patterns) {
      if (p.regex.test(q)) {
        maxScore = Math.max(maxScore, p.weight);
        matches.push(p.cap);
      }
    }

    // Direct phone number dialing pattern (e.g. "0612345678" or "+33...")
    if (/^(appeler?\s+)?(\+?\d[\d\s\-\.]{5,}\d)$/i.test(q)) {
      maxScore = 0.95;
      matches.push('place_phone_call');
    }

    return {
      agentId: this.id,
      score: maxScore,
      confidence: maxScore > 0.5 ? 0.95 : 0.35,
      reason: matches.length > 0
        ? `Intention téléphonique identifiée : ${matches.join(', ')}`
        : 'Pas d’intention téléphonique détectée.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: ['android.permission.READ_CONTACTS', 'android.permission.READ_CALL_LOG'],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const q = input.query.trim();
      const lower = q.toLowerCase();

      // If this is a confirmation token resolution from client context
      if (input.context?.confirmationToken) {
        return this.handleCallExecution(input.context.confirmationToken, startTime);
      }

      // CASE 1: "Qui m'a appelé ?"
      if (/qui m['’]?a appel|qui a tent|qui a appel/i.test(lower)) {
        return this.handleWhoCalledMe(startTime);
      }

      // CASE 2: "Montre mes appels récents." / Journal d'appels
      if (/montre.*appels?|historique.*appels?|journal.*appels?|appels récents/i.test(lower)) {
        return this.handleShowRecentCalls(startTime);
      }

      // CASE 3: "Appelle le dernier appel manqué."
      if (/dernier appel manqu|rappelle.*manqu|rappelle.*dernier/i.test(lower)) {
        return this.handleCallLastMissed(startTime);
      }

      // CASE 4: "Appelle [Contact / Numéro]"
      return this.handlePrepareCall(q, startTime);
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  /**
   * 1. Handling "Qui m'a appelé ?"
   */
  private handleWhoCalledMe(startTime: number): AgentOutput {
    const res = CallManager.whoCalledMe(48);

    if (!res.success || !res.summary) {
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `⚠️ ${res.error || 'Impossible d’accéder au journal d’appels.'}\n\n💡 ${res.actionNeeded || 'Veuillez accorder la permission READ_CALL_LOG.'}`,
        spokenSummary: 'Accès au journal d’appels non autorisé.',
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'call-log-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          permissionDenied: true,
          permission: 'android.permission.READ_CALL_LOG',
          actionNeeded: res.actionNeeded,
        },
      };
    }

    const { totalCalls, missedCount, incomingCount, callers } = res.summary;

    if (callers.length === 0) {
      const reply = `Aucun appel enregistré au cours des dernières 48 heures.`;
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply,
        spokenSummary: 'Aucun appel au cours des dernières 48 heures.',
        actionTaken: true,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'call-log-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: { callers: [] },
      };
    }

    let reply = `📞 **Synthèse de vos correspondants récents (${totalCalls} appels sur 48h) :**\n\n`;
    reply += `• Appels manqués : **${missedCount}**\n• Appels reçus : **${incomingCount}**\n\n`;
    reply += `**Détail des correspondants :**\n`;

    for (const c of callers) {
      const icon = c.type === 'missed' ? '🔴' : '🟢';
      const label = c.type === 'missed' ? 'Appel manqué' : 'Appel reçu';
      reply += `${icon} **${c.name}** (${c.number})\n   ↳ *${label} ${c.timeAgoFormatted}${c.count > 1 ? ` (${c.count} fois)` : ''}*\n`;
    }

    const firstMissed = callers.find((c) => c.type === 'missed');
    const spokenSummary = firstMissed
      ? `Vous avez un appel manqué de ${firstMissed.name} ${firstMissed.timeAgoFormatted}. Souhaitez-vous le rappeler ?`
      : `Vous avez reçu ${incomingCount} appels récents, notamment de ${callers[0]?.name}.`;

    return {
      id: `out_phone_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      telemetry: {
        providerUsed: 'android_telephony_bridge',
        modelUsed: 'call-log-resolver',
        fallbackOccurred: false,
        providerChainAttempted: ['android_telephony_bridge'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: { callers, summary: res.summary },
      nextSuggestions: [
        firstMissed ? `Appelle ${firstMissed.name}` : 'Montre mes appels récents',
        'Appelle le dernier appel manqué',
        'Ouvre le composeur téléphonique',
      ],
    };
  }

  /**
   * 2. Handling "Montre mes appels récents."
   */
  private handleShowRecentCalls(startTime: number): AgentOutput {
    const res = CallManager.getRecentCalls(8);

    if (!res.success || !res.logs) {
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `⚠️ ${res.error || 'Impossible d’accéder au journal d’appels.'}\n\n💡 ${res.actionNeeded || 'Veuillez accorder la permission READ_CALL_LOG.'}`,
        spokenSummary: 'Accès au journal d’appels refusé par Android.',
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'call-log-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          permissionDenied: true,
          permission: 'android.permission.READ_CALL_LOG',
          actionNeeded: res.actionNeeded,
        },
      };
    }

    let reply = `📋 **Journal des Appels Récents Android (CallLog.Calls) :**\n\n`;

    for (const log of res.logs) {
      const typeIcon = log.type === 'missed' ? '🔴 [Manqué]' : log.type === 'outgoing' ? '↗️ [Sortant]' : '↙️ [Entrant]';
      const timeStr = new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(log.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const durationStr = log.durationSeconds > 0 ? ` (${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s)` : '';

      reply += `• ${typeIcon} **${log.cachedName}** — \`${log.formattedNumber}\`\n   ↳ ${dateStr} à ${timeStr}${durationStr}\n`;
    }

    return {
      id: `out_phone_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: `Voici vos ${res.logs.length} derniers appels enregistrés.`,
      actionTaken: true,
      telemetry: {
        providerUsed: 'android_telephony_bridge',
        modelUsed: 'call-log-resolver',
        fallbackOccurred: false,
        providerChainAttempted: ['android_telephony_bridge'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: { logs: res.logs },
      nextSuggestions: [
        'Appelle le dernier appel manqué',
        'Qui m’a appelé ?',
        'Vérifie mes permissions téléphoniques',
      ],
    };
  }

  /**
   * 3. Handling "Appelle le dernier appel manqué."
   */
  private handleCallLastMissed(startTime: number): AgentOutput {
    const prepRes = CallManager.prepareCall({ lastMissed: true });

    if (!prepRes.success || !prepRes.preparedCall) {
      const errorMsg = prepRes.error || 'Impossible d’identifier le dernier appel manqué.';
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `⚠️ ${errorMsg}${prepRes.actionNeeded ? `\n\n💡 ${prepRes.actionNeeded}` : ''}`,
        spokenSummary: errorMsg,
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'call-manager',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          error: errorMsg,
          actionNeeded: prepRes.actionNeeded,
        },
      };
    }

    const { preparedCall } = prepRes;
    const reply = `📞 **Dernier appel manqué détecté :**\n\n• **Correspondant :** ${preparedCall.targetName}\n• **Numéro :** \`${preparedCall.number}\`\n• **Action :** ${preparedCall.intentAction === 'android.intent.action.CALL' ? 'Appel direct' : 'Composeur Android'}\n\n🔒 **Confirmation requise :** Souhaitez-vous lancer l’appel vers **${preparedCall.targetName}** ?`;
    const spokenSummary = `Le dernier appel manqué provient de ${preparedCall.targetName}. Voulez-vous que je l'appelle ?`;

    return {
      id: `out_phone_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      telemetry: {
        providerUsed: 'android_telephony_bridge',
        modelUsed: 'call-manager',
        fallbackOccurred: false,
        providerChainAttempted: ['android_telephony_bridge'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: {
        requiresConfirmation: true,
        confirmationRequest: {
          id: preparedCall.id,
          operation: 'phone_call',
          targetName: preparedCall.targetName,
          phoneNumber: preparedCall.number,
          intentAction: preparedCall.intentAction,
          summary: `Appeler ${preparedCall.targetName} (${preparedCall.number})`,
        },
      },
      nextSuggestions: [
        `Confirmer l'appel vers ${preparedCall.targetName}`,
        'Annuler',
        'Montre mes appels récents',
      ],
    };
  }

  /**
   * 4. Handling "Appelle [Sarah / Contact / Numéro]"
   */
  private handlePrepareCall(query: string, startTime: number): AgentOutput {
    // Extract target name or number
    let target = query
      .replace(/^jarvis\s*/i, '')
      .replace(/^(s'il te plaît|stp)\s*/i, '')
      .replace(/^(appelle|téléphone à|passe un coup de fil à|compose le numéro de|compose)\s+/i, '')
      .trim();

    if (!target) {
      target = 'Sarah';
    }

    // Resolve contact or handle disambiguation / errors
    const prepRes = CallManager.prepareCall({ contactName: target });

    // Edge Case A: Contact inexistant
    if (prepRes.resolution?.status === 'not_found') {
      const suggestions = prepRes.resolution.suggestions?.join(', ') || 'Sarah Connor, Maman';
      const reply = `❌ **Contact inexistant :** ${prepRes.resolution.message}\n\n💡 **Suggestions de votre répertoire :** ${suggestions}\n*Vous pouvez aussi dicter directement le numéro à 10 chiffres (ex: 06 12 34 56 78).*`;
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: redactSecrets(reply),
        spokenSummary: `Je n'ai trouvé aucun contact pour ${target} dans votre répertoire.`,
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'contact-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: { status: 'not_found', target, suggestions: prepRes.resolution.suggestions },
        nextSuggestions: [
          'Appelle Sarah Connor',
          'Appelle Maman',
          'Montre mes appels récents',
        ],
      };
    }

    // Edge Case B: Plusieurs contacts identiques / Homonymes (Disambiguation)
    if (prepRes.resolution?.status === 'multiple_matches') {
      let reply = `👥 **Plusieurs correspondants correspondent à "${target}" :**\n\n`;
      for (let i = 0; i < prepRes.resolution.candidates.length; i++) {
        const c = prepRes.resolution.candidates[i];
        reply += `${i + 1}. **${c.label}**\n`;
      }
      reply += `\n❓ **Précisez le correspondant à joindre :** Cliquez sur une option ci-dessous ou dites par exemple *"Appelle ${prepRes.resolution.candidates[0].contact.displayName}"*.`;

      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: `J'ai trouvé plusieurs correspondants pour ${target}. Lequel souhaitez-vous appeler ?`,
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'contact-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          disambiguationRequired: true,
          candidates: prepRes.resolution.candidates,
        },
        nextSuggestions: prepRes.resolution.candidates.map((c) => `Appelle ${c.label}`),
      };
    }

    // Edge Case C: Permission refusée
    if (prepRes.resolution?.status === 'permission_denied') {
      const reply = `⚠️ **Permission Android requise :** ${prepRes.resolution.message}\n\n💡 **Action requise :** ${prepRes.resolution.actionNeeded}\n*JARVIS respecte la sécurité Android et ne contourne pas vos autorisations système.*`;
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: redactSecrets(reply),
        spokenSummary: `L'accès aux contacts est refusé. Veuillez accorder la permission dans les paramètres Android.`,
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'permission-gate',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          permissionDenied: true,
          permission: prepRes.resolution.permission,
          actionNeeded: prepRes.resolution.actionNeeded,
        },
      };
    }

    // Edge Case D: Numéro invalide
    if (prepRes.resolution?.status === 'invalid_number') {
      const reply = `❌ **Numéro invalide :** ${prepRes.resolution.message}\n\n💡 Veuillez fournir un numéro au format français (ex: 06 12 34 56 78) ou international E.164 (ex: +33 6 12 34 56 78).`;
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: redactSecrets(reply),
        spokenSummary: `Le numéro de téléphone spécifié est invalide.`,
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'contact-resolver',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: { status: 'invalid_number', error: prepRes.resolution.message },
      };
    }

    // Case E: Ready with confirmation
    if (prepRes.preparedCall) {
      const { preparedCall } = prepRes;
      const isDirect = preparedCall.intentAction === 'android.intent.action.CALL';
      const actionType = isDirect ? 'Appel direct' : 'Composeur Android (Intent.ACTION_DIAL)';

      const reply = `📞 **Préparation de l'appel :**\n\n• **Destinataire :** ${preparedCall.targetName}\n• **Numéro :** \`${preparedCall.number}\`\n• **Protocole Android :** \`${preparedCall.intentAction}\` (${actionType})\n\n🔒 **Confirmation :** Cliquez sur **Confirmer l'appel** ou dites *"Oui, appelle ${preparedCall.targetName}"*.`;
      const spokenSummary = `Prêt à appeler ${preparedCall.targetName} au ${preparedCall.number}. Voulez-vous confirmer ?`;

      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: true,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'call-manager',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: {
          requiresConfirmation: true,
          confirmationRequest: {
            id: preparedCall.id,
            operation: 'phone_call',
            targetName: preparedCall.targetName,
            phoneNumber: preparedCall.number,
            intentAction: preparedCall.intentAction,
            summary: `Appeler ${preparedCall.targetName} (${preparedCall.number})`,
          },
        },
        nextSuggestions: [
          `Confirmer l'appel vers ${preparedCall.targetName}`,
          'Annuler',
          'Montre mes appels récents',
        ],
      };
    }

    return this.handleError(
      new Error(prepRes.error || 'Erreur inconnue lors de la préparation de l’appel'),
      { id: `req_${Date.now()}`, query },
      startTime
    );
  }

  /**
   * 5. Execution of Call after Confirmation Token
   */
  private handleCallExecution(token: string, startTime: number): AgentOutput {
    const initRes = CallManager.initiateCall(token);

    if (!initRes.success || !initRes.intentLaunched) {
      return {
        id: `out_phone_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `⚠️ ${initRes.error || 'Échec du lancement de l’appel.'}`,
        spokenSummary: 'Échec du lancement de l’appel.',
        actionTaken: false,
        telemetry: {
          providerUsed: 'android_telephony_bridge',
          modelUsed: 'intent-launcher',
          fallbackOccurred: false,
          providerChainAttempted: ['android_telephony_bridge'],
          executionTimeMs: Date.now() - startTime,
        },
      };
    }

    const { intentLaunched } = initRes;
    const reply = `🚀 **Appel en cours d’émission !**\n\n• **Correspondant :** ${intentLaunched.targetName}\n• **Numéro composé :** \`${intentLaunched.number}\`\n• **Intent Android :** \`${intentLaunched.action}\` (${intentLaunched.uri})\n\n✅ L'appel a été transmis au gestionnaire téléphonique Android natif.`;
    const spokenSummary = `Appel vers ${intentLaunched.targetName} lancé avec succès.`;

    return {
      id: `out_phone_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      actionsExecuted: [
        {
          tool: 'initiate_phone_call',
          arguments: { token, uri: intentLaunched.uri },
          result: intentLaunched,
          latencyMs: Date.now() - startTime,
          success: true,
        },
      ],
      telemetry: {
        providerUsed: 'android_telephony_bridge',
        modelUsed: 'intent-launcher',
        fallbackOccurred: false,
        providerChainAttempted: ['android_telephony_bridge'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: {
        callLaunched: true,
        intent: intentLaunched,
      },
      nextSuggestions: [
        'Montre mes appels récents',
        'Qui m’a appelé ?',
        'Envoie un SMS à ce contact',
      ],
    };
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_phone_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `Impossible de finaliser l'action téléphonique : ${error?.message || String(error)}`,
      spokenSummary: 'Une erreur est survenue lors de l’opération téléphonique.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'PHONE_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez la carte SIM, les permissions et le format du numéro.',
      },
    };
  }
}
