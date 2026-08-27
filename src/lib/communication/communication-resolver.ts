/**
 * COMMUNICATION RESOLVER (PHASE 4)
 * 
 * Accurately parses user voice and text queries regarding messaging:
 * - "Lis mes messages." -> READ_MESSAGES (all unread)
 * - "Lis mes messages WhatsApp." -> READ_MESSAGES (filtered to WhatsApp)
 * - "Quels messages nécessitent une réponse ?" -> LIST_REQUIRES_REPLY
 * - "Réponds à Sarah." -> PREPARE_REPLY (targeted draft)
 * - "Prépare une réponse." -> PREPARE_REPLY (for latest actionable message)
 * - "Active le mode privé." / "Désactive le mode privé." -> TOGGLE_PRIVATE_MODE
 */

import { CommunicationSource, MessageClassification } from './types.js';

export type CommunicationIntentType =
  | 'READ_MESSAGES'
  | 'SUMMARIZE_MESSAGES'
  | 'LIST_REQUIRES_REPLY'
  | 'PREPARE_REPLY'
  | 'SEND_REPLY'
  | 'OPEN_COMM_APP'
  | 'TOGGLE_PRIVATE_MODE'
  | 'UNKNOWN';

export interface ResolvedCommunicationCommand {
  intent: CommunicationIntentType;
  rawQuery: string;
  sourceFilter?: CommunicationSource;
  targetContact?: string;
  userInstruction?: string;
  requiresConfirmation: boolean;
  isPrivateModeRequest?: boolean;
  spokenFeedback: string;
}

export class CommunicationResolver {
  public static resolve(query: string): ResolvedCommunicationCommand {
    const q = (query || '').toLowerCase().trim();

    // 1. Target source extraction
    let sourceFilter: CommunicationSource | undefined;
    if (q.includes('whatsapp')) sourceFilter = 'whatsapp';
    else if (q.includes('sms') || q.includes('texto') || q.includes('textos')) sourceFilter = 'sms';
    else if (q.includes('telegram')) sourceFilter = 'telegram';
    else if (q.includes('messenger')) sourceFilter = 'messenger';
    else if (q.includes('signal')) sourceFilter = 'signal';

    // 2. Private mode toggle
    if (q.includes('mode privé') || q.includes('mode prive') || q.includes('confidentiel')) {
      const isEnable = !q.includes('désactive') && !q.includes('desactive') && !q.includes('retire');
      return {
        intent: 'TOGGLE_PRIVATE_MODE',
        rawQuery: query,
        isPrivateModeRequest: isEnable,
        requiresConfirmation: false,
        spokenFeedback: isEnable
          ? 'Mode privé activé. Les contenus et expéditeurs seront protégés lors de la lecture.'
          : 'Mode privé désactivé.',
      };
    }

    // 3. "Quels messages nécessitent une réponse ?" / messages urgents
    if (
      q.includes('nécessitent une réponse') ||
      q.includes('necessitent une reponse') ||
      q.includes('attendent une réponse') ||
      q.includes('qui a besoin d\'une réponse') ||
      q.includes('messages urgents') ||
      q.includes('qui me cherche') ||
      q.includes('qui m\'écrit') ||
      q.includes('qui a écrit')
    ) {
      return {
        intent: 'LIST_REQUIRES_REPLY',
        rawQuery: query,
        sourceFilter,
        requiresConfirmation: false,
        spokenFeedback: 'Analyse des messages en attente de réponse en cours.',
      };
    }

    // Clean string for regex matching (strip trailing punctuation)
    const sanitizedQuery = q.replace(/[.!?,;]+$/, '').trim();

    // 4. "Réponds à [Contact]" / "Dis à [Contact] que..." / "Envoie un message à [Contact]"
    const replyContactMatch = sanitizedQuery.match(/^(?:jarvis[, ]*)?(?:réponds|reponds|écris|ecris|envoie un message|envoie un sms|dis)\s+(?:à|a|au)\s+([a-zA-ZÀ-ÿ0-9_\-\s]+?)(?:\s+(?:que|disant|pour dire)\s+(.*)|$)/i);
    if (replyContactMatch) {
      const targetContact = replyContactMatch[1].trim();
      const userInstruction = replyContactMatch[2] ? replyContactMatch[2].trim() : undefined;

      return {
        intent: 'PREPARE_REPLY',
        rawQuery: query,
        sourceFilter,
        targetContact,
        userInstruction,
        requiresConfirmation: true,
        spokenFeedback: `Préparation d'une réponse pour ${targetContact}.`,
      };
    }

    // 5. "Prépare une réponse." / "Génère une réponse" (to latest message)
    if (
      q.includes('prépare une réponse') ||
      q.includes('prepare une reponse') ||
      q.includes('propose une réponse') ||
      q.includes('rédige une réponse') ||
      q.includes('brouillon de réponse')
    ) {
      return {
        intent: 'PREPARE_REPLY',
        rawQuery: query,
        sourceFilter,
        requiresConfirmation: true,
        spokenFeedback: 'Génération du brouillon de réponse pour le dernier message reçu.',
      };
    }

    // 6. "Lis mes messages." / "Lis mes messages WhatsApp." / "Résume mes messages"
    if (
      q.includes('lis mes messages') ||
      q.includes('lis mes notifications') ||
      q.includes('lis mes sms') ||
      q.includes('lis mes whatsapp') ||
      q.includes('résume mes messages') ||
      q.includes('resume mes messages') ||
      q.includes('ai-je des messages') ||
      q.includes('nouveaux messages') ||
      q.includes('derniers messages') ||
      q.includes('lire mes messages')
    ) {
      const appName = sourceFilter ? ` sur ${sourceFilter.toUpperCase()}` : '';
      return {
        intent: 'READ_MESSAGES',
        rawQuery: query,
        sourceFilter,
        requiresConfirmation: false,
        spokenFeedback: `Lecture de vos messages non lus${appName}.`,
      };
    }

    // 7. General messages intent
    if (q.includes('message') || q.includes('notif') || q.includes('whatsapp') || q.includes('telegram')) {
      return {
        intent: 'SUMMARIZE_MESSAGES',
        rawQuery: query,
        sourceFilter,
        requiresConfirmation: false,
        spokenFeedback: 'Consultation du centre de communications.',
      };
    }

    return {
      intent: 'UNKNOWN',
      rawQuery: query,
      requiresConfirmation: false,
      spokenFeedback: 'Instruction de communication non reconnue.',
    };
  }
}
