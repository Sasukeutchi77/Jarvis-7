/**
 * COMMUNICATION AGENT (Specialized Agent — Phase 4)
 * 
 * Manages notification listener feeds, contact triage, context-aware smart replies,
 * human confirmation protocols, and official Android NotificationCompat RemoteInput dispatch.
 * 
 * Commands:
 * - "Lis mes messages."
 * - "Lis mes messages WhatsApp."
 * - "Quels messages nécessitent une réponse ?"
 * - "Réponds à Sarah."
 * - "Prépare une réponse."
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
import { redactSecrets } from '../../services/security-redactor.js';
import { AndroidBridge } from '../../android-bridge.js';
import {
  CommunicationResolver,
  ResolvedCommunicationCommand,
} from '../../communication/communication-resolver.js';
import { ConversationManager } from '../../communication/conversation-manager.js';
import { SUPPORTED_COMMUNICATION_SOURCES } from '../../communication/notification-parser.js';
import {
  IncomingMessage,
  CommunicationSource,
} from '../../communication/types.js';

export class CommunicationAgent implements SpecializedAgent {
  public readonly id: AgentId = 'communication';
  public readonly name = 'JARVIS Communication Agent';
  public readonly description = 'Spécialiste du NotificationListenerService, de la lecture vocale intelligente, du classement et de la réponse assistée (WhatsApp, SMS, Telegram, Messenger, Signal).';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  private conversationManager = ConversationManager.getInstance();
  private privateMode = false;

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'notification_reading',
      name: 'Lecture & Triage des Notifications',
      description: 'Analyse et vocalisation sécurisée des notifications de messages (WhatsApp, SMS, Telegram, Messenger).',
      tags: ['lis mes messages', 'lis mes messages whatsapp', 'nouveaux messages', 'notif', 'sms'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'medium',
    },
    {
      id: 'draft_reply_generation',
      name: 'Génération de Réponses & Brouillons',
      description: 'Génération contextuelle de réponses intelligentes avec confirmation humaine obligatoire.',
      tags: ['réponds à', 'reponds a', 'prépare une réponse', 'prepare une reponse', 'écris à', 'sms à'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'medium',
    },
    {
      id: 'requires_reply_triage',
      name: 'Triage des Messages en Attente',
      description: 'Identification des messages nécessitant une action ou réponse immédiate.',
      tags: ['quels messages nécessitent une réponse', 'qui attend une réponse', 'messages urgents'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'low',
    },
    {
      id: 'private_mode_guard',
      name: 'Mode Privé & Confidentialité',
      description: 'Masquage des expéditeurs et contenus confidentiels lors de la lecture audio.',
      tags: ['mode privé', 'confidentiel', 'masque messages'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'read_messages',
      description: 'Lit et résume les messages reçus avec filtrage par application.',
      parameters: { source: { type: 'string' }, unreadOnly: { type: 'boolean' } },
    },
    {
      name: 'list_messages_requiring_reply',
      description: 'Liste les messages qui attendent une réponse ou sont urgents.',
      parameters: { source: { type: 'string' } },
    },
    {
      name: 'prepare_reply_draft',
      description: 'Prépare un brouillon de réponse pour un contact spécifique ou le dernier message.',
      parameters: { contact: { type: 'string' }, userInstruction: { type: 'string' } },
    },
    {
      name: 'dispatch_reply',
      description: 'Envoie la réponse via l’action Android RemoteInput officielle.',
      parameters: { messageId: { type: 'string' }, replyText: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const resolved = CommunicationResolver.resolve(input.query);

    if (resolved.intent !== 'UNKNOWN') {
      return {
        agentId: this.id,
        score: 0.98,
        confidence: 0.98,
        reason: `Intention de communication identifiée : ${resolved.intent}`,
        matchedCapabilities: [resolved.intent.toLowerCase()],
        requiredPermissions: ['notification_listener'],
        isPermissionMet: true,
      };
    }

    const q = input.query.toLowerCase();
    const commKeywords = [
      'message', 'messages', 'sms', 'whatsapp', 'telegram', 'signal', 'messenger',
      'lis mes', 'réponds', 'reponds', 'notif', 'notification'
    ];

    let score = 0.05;
    for (const kw of commKeywords) {
      if (q.includes(kw)) score += 0.35;
    }
    score = Math.min(score, 0.9);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.5 ? 0.9 : 0.3,
      reason: score > 0.5 ? 'Requête de communication détectée.' : 'Non pertinent.',
      matchedCapabilities: ['notification_reading'],
      requiredPermissions: ['notification_listener'],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const resolved = CommunicationResolver.resolve(input.query);

    try {
      switch (resolved.intent) {
        case 'TOGGLE_PRIVATE_MODE':
          return this.handleTogglePrivateMode(resolved, input, startTime);

        case 'LIST_REQUIRES_REPLY':
          return this.handleListRequiresReply(resolved, input, startTime);

        case 'PREPARE_REPLY':
          return this.handlePrepareReply(resolved, input, startTime);

        case 'READ_MESSAGES':
        case 'SUMMARIZE_MESSAGES':
        default:
          return this.handleReadMessages(resolved, input, startTime);
      }
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  /**
   * Handle: "Lis mes messages." / "Lis mes messages WhatsApp."
   */
  private async handleReadMessages(
    cmd: ResolvedCommunicationCommand,
    input: AgentInput,
    startTime: number
  ): Promise<AgentOutput> {
    const messages = this.conversationManager.getAllMessages({
      source: cmd.sourceFilter,
      unreadOnly: true,
    });

    const sourceName = cmd.sourceFilter
      ? SUPPORTED_COMMUNICATION_SOURCES[cmd.sourceFilter]?.displayName || cmd.sourceFilter
      : '';

    let reply = '';
    let spokenSummary = '';

    if (messages.length === 0) {
      reply = sourceName
        ? `Vous n'avez aucun nouveau message sur **${sourceName}**, Monsieur.`
        : `Vous n'avez aucun nouveau message non lu, Monsieur.`;
      spokenSummary = reply.replace(/\*\*/g, '');
    } else {
      if (this.privateMode) {
        reply = `🔒 **Mode Privé Actif** : Vous avez ${messages.length} nouveau(x) message(s) en attente. Les détails et expéditeurs sont masqués.`;
        spokenSummary = `Monsieur, vous avez ${messages.length} nouveaux messages. Le mode privé est actif, le contenu reste confidentiel.`;
      } else {
        const details = messages.map((m) => {
          const catIcon = m.category === 'urgent' ? '🔴' : m.category === 'to_reply' ? '🟡' : '💬';
          return `- ${catIcon} **${m.sender}** (${m.appName}) : "${m.content}"`;
        }).join('\n');

        reply = `Voici vos messages non lus${sourceName ? ` sur **${sourceName}**` : ''} :\n\n${details}\n\n*Voulez-vous que je réponde à l'un d'eux ?*`;

        const vocalDetails = messages.map((m) => {
          if (m.category === 'urgent') {
            return `Message urgent de ${m.sender} sur ${m.appName} : ${m.content}`;
          }
          return `De ${m.sender} sur ${m.appName} : ${m.content}`;
        }).join('. ');

        spokenSummary = `Vous avez ${messages.length} message(s). ${vocalDetails}. Souhaitez-vous que je prépare une réponse ?`;
      }
    }

    return {
      id: `out_comm_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      actionsExecuted: [
        {
          tool: 'read_messages',
          arguments: { source: cmd.sourceFilter, count: messages.length },
          result: { count: messages.length, privateMode: this.privateMode },
          latencyMs: Date.now() - startTime,
          success: true,
        },
      ],
      telemetry: {
        providerUsed: 'notification_listener_service',
        modelUsed: 'local_comm_triage',
        fallbackOccurred: false,
        providerChainAttempted: ['notification_listener_service'],
        executionTimeMs: Date.now() - startTime,
      },
      nextSuggestions: [
        'Quels messages nécessitent une réponse ?',
        'Réponds à Sarah',
        'Prépare une réponse',
        'Active le mode privé',
      ],
    };
  }

  /**
   * Handle: "Quels messages nécessitent une réponse ?"
   */
  private async handleListRequiresReply(
    cmd: ResolvedCommunicationCommand,
    input: AgentInput,
    startTime: number
  ): Promise<AgentOutput> {
    const all = this.conversationManager.getAllMessages({
      source: cmd.sourceFilter,
      requiresReplyOnly: true,
    });

    let reply = '';
    let spokenSummary = '';

    if (all.length === 0) {
      reply = 'Aucun message en attente ne requiert de réponse immédiate, Monsieur.';
      spokenSummary = reply;
    } else {
      if (this.privateMode) {
        reply = `🔒 **Mode Privé** : ${all.length} message(s) nécessite(nt) une réponse. Expéditeurs confidentiels.`;
        spokenSummary = `Monsieur, ${all.length} message nécessite votre attention en mode privé.`;
      } else {
        const lines = all.map((m) => {
          const badge = m.category === 'urgent' ? '🔴 **URGENT**' : '🟡 **À RÉPONDRE**';
          return `- ${badge} | **${m.sender}** (${m.appName}) : "${m.content}"`;
        }).join('\n');

        reply = `Voici les messages nécessitant une réponse :\n\n${lines}\n\n*Dites simplement : "Réponds à [Contact]" pour que je prépare votre message.*`;

        const vocalList = all.map((m) => `${m.sender} sur ${m.appName}`).join(', ');
        spokenSummary = `Il y a ${all.length} message(s) en attente de réponse, provenant de : ${vocalList}. Que souhaitez-vous faire ?`;
      }
    }

    return {
      id: `out_comm_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      actionsExecuted: [
        {
          tool: 'list_messages_requiring_reply',
          arguments: { count: all.length },
          result: { count: all.length },
          latencyMs: Date.now() - startTime,
          success: true,
        },
      ],
      telemetry: {
        providerUsed: 'notification_classifier',
        modelUsed: 'triage_engine',
        fallbackOccurred: false,
        providerChainAttempted: ['notification_classifier'],
        executionTimeMs: Date.now() - startTime,
      },
      nextSuggestions: [
        'Réponds à Sarah',
        'Réponds à Alexandre',
        'Lis mes messages',
      ],
    };
  }

  /**
   * Handle: "Réponds à Sarah." / "Prépare une réponse."
   * Always asks for confirmation before sending!
   */
  private async handlePrepareReply(
    cmd: ResolvedCommunicationCommand,
    input: AgentInput,
    startTime: number
  ): Promise<AgentOutput> {
    let targetMsg: IncomingMessage | undefined;

    if (cmd.targetContact) {
      const match = this.conversationManager.findByContact(cmd.targetContact, cmd.sourceFilter);
      targetMsg = match.message;
    }

    if (!targetMsg) {
      // Default to latest message needing reply or latest message
      const needReply = this.conversationManager.getAllMessages({
        source: cmd.sourceFilter,
        requiresReplyOnly: true,
      });
      targetMsg = needReply[0] || this.conversationManager.getAllMessages({ source: cmd.sourceFilter })[0];
    }

    if (!targetMsg) {
      const targetName = cmd.targetContact ? `de **${cmd.targetContact}**` : '';
      return {
        id: `out_comm_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: `Aucun message récent trouvé ${targetName}. Vous pouvez ouvrir directement l'application pour composer un nouveau message.`,
        spokenSummary: `Je n'ai pas trouvé de message récent pour ce contact.`,
        actionTaken: false,
        actionsExecuted: [],
        telemetry: {
          providerUsed: 'local_lookup',
          modelUsed: 'conversation_search',
          fallbackOccurred: false,
          providerChainAttempted: ['local_lookup'],
          executionTimeMs: Date.now() - startTime,
        },
      };
    }

    // Generate intelligent suggested reply draft
    let draftText = '';
    if (cmd.userInstruction) {
      draftText = cmd.userInstruction;
    } else if (targetMsg.suggestedReply) {
      draftText = targetMsg.suggestedReply;
    } else {
      draftText = `Bonjour ${targetMsg.sender}, bien reçu ton message. Je regarde cela dès maintenant.`;
    }

    const replyMethodNote = targetMsg.replyAvailable
      ? `📱 Action Android : **RemoteInput Direct Reply** disponible.`
      : `⚠️ Action directe indisponible : J'ouvrirai **${targetMsg.appName}** avec le texte prêt.`;

    const reply = `### ✉️ Brouillon de réponse préparé
- **Destinataire** : **${targetMsg.sender}** (${targetMsg.appName})
- **Message reçu** : *"${targetMsg.content}"*
- **Proposition de réponse** :
> "${draftText}"

${replyMethodNote}

🔒 **Confirmation de sécurité requise** : Souhaitez-vous que j'envoie cette réponse ?`;

    const spokenSummary = `J'ai préparé la réponse pour ${targetMsg.sender} : "${draftText}". Dois-je l'envoyer ?`;

    return {
      id: `out_comm_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      structuredData: {
        pendingConfirmation: {
          id: `conf_reply_${Date.now()}`,
          actionType: 'send_message',
          title: `Confirmer l'envoi du message`,
          prompt: `Envoyer le message à ${targetMsg.sender} sur ${targetMsg.appName} ?`,
          targetDescription: `Destinataire : ${targetMsg.sender}\nApplication : ${targetMsg.appName}\nTexte : "${draftText}"`,
          severity: 'medium',
          timestamp: Date.now(),
          payload: {
            messageId: targetMsg.id,
            packageName: targetMsg.packageName,
            contactName: targetMsg.sender,
            replyText: draftText,
            notificationKey: targetMsg.notificationKey,
            replyAvailable: targetMsg.replyAvailable,
          },
        },
      },
      actionsExecuted: [
        {
          tool: 'prepare_reply_draft',
          arguments: {
            contact: targetMsg.sender,
            instruction: cmd.userInstruction,
          },
          result: { draft: draftText, directReplySupported: targetMsg.replyAvailable },
          latencyMs: Date.now() - startTime,
          success: true,
        },
      ],
      telemetry: {
        providerUsed: 'smart_draft_engine',
        modelUsed: 'context_reply_generator',
        fallbackOccurred: false,
        providerChainAttempted: ['smart_draft_engine'],
        executionTimeMs: Date.now() - startTime,
      },
      nextSuggestions: [
        'Confirmer et envoyer',
        'Modifier le brouillon',
        'Annuler l\'envoi',
      ],
    };
  }

  /**
   * Handle: "Active le mode privé."
   */
  private handleTogglePrivateMode(
    cmd: ResolvedCommunicationCommand,
    input: AgentInput,
    startTime: number
  ): AgentOutput {
    this.privateMode = Boolean(cmd.isPrivateModeRequest);

    const reply = this.privateMode
      ? `🔒 **Mode Privé Activé** : Les notifications vocales ne prononceront plus les noms d'expéditeurs ni le contenu des messages à voix haute.`
      : `🔓 **Mode Privé Désactivé** : La lecture vocale complète est rétablie.`;

    const spokenSummary = cmd.spokenFeedback;

    return {
      id: `out_comm_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply: redactSecrets(reply),
      spokenSummary: redactSecrets(spokenSummary),
      actionTaken: true,
      actionsExecuted: [
        {
          tool: 'toggle_private_mode',
          arguments: { privateMode: this.privateMode },
          result: { privateMode: this.privateMode },
          latencyMs: Date.now() - startTime,
          success: true,
        },
      ],
      telemetry: {
        providerUsed: 'privacy_guard',
        modelUsed: 'local_security',
        fallbackOccurred: false,
        providerChainAttempted: ['privacy_guard'],
        executionTimeMs: Date.now() - startTime,
      },
      nextSuggestions: [
        'Lis mes messages',
        'Quels messages nécessitent une réponse ?',
      ],
    };
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_comm_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Impossible de traiter la demande de communication.',
      spokenSummary: 'Erreur d’accès aux communications.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'COMMUNICATION_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez les autorisations du service NotificationListener dans les paramètres Android.',
      },
    };
  }
}
