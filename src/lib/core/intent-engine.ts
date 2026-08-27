/**
 * INTENT UNDERSTANDING ENGINE (JARVIS Core Intelligence)
 * 
 * Extracts semantic intent, target entities, confidence scores,
 * required Android permissions, and security risk tiers before execution.
 * 
 * Pipeline:
 * USER INPUT (Voice/Text)
 *    ↓
 * INTENT UNDERSTANDING
 *    ↓
 * CONTEXT ENRICHMENT
 *    ↓
 * SPECIALIZED AGENT SELECTION
 */

import { AgentId } from '../agents/agent-protocol.js';

export type IntentCategory =
  | 'COMMUNICATION_MESSAGES'
  | 'NOTIFICATION_READ'
  | 'ANDROID_OPEN_APP'
  | 'ANDROID_SYSTEM_CONTROL'
  | 'WEATHER_QUERY'
  | 'WEB_SEARCH'
  | 'PHONE_CALL'
  | 'SCREEN_VISION'
  | 'CALENDAR_REMINDERS'
  | 'GENERAL_KNOWLEDGE'
  | 'EMERGENCY_STOP';

export type ActionSecurityTier = 'READ' | 'SAFE_ACTION' | 'SENSITIVE_ACTION';

export interface ExtractedEntities {
  targetApp?: string;
  contactName?: string;
  searchTopic?: string;
  location?: string;
  settingName?: string;
  settingValue?: string | number | boolean;
  timeContext?: string;
  rawQuery: string;
}

export interface ParsedIntent {
  category: IntentCategory;
  intentName: string;
  targetAgent: AgentId;
  entities: ExtractedEntities;
  confidence: number;
  securityTier: ActionSecurityTier;
  requiresConfirmation: boolean;
  requiredPermissions: string[];
  explanation: string;
}

export class IntentUnderstandingEngine {
  private static instance: IntentUnderstandingEngine;

  private constructor() {}

  public static getInstance(): IntentUnderstandingEngine {
    if (!IntentUnderstandingEngine.instance) {
      IntentUnderstandingEngine.instance = new IntentUnderstandingEngine();
    }
    return IntentUnderstandingEngine.instance;
  }

  /**
   * Parses user input into a rich semantic intent representation
   */
  public understandIntent(query: string, context?: Record<string, any>): ParsedIntent {
    const raw = (query || '').trim();
    const lower = raw.toLowerCase();

    // 0. Emergency Stop
    if (lower === 'stop' || lower === 'jarvis stop' || lower === 'arrête-toi' || lower === 'annule') {
      return {
        category: 'EMERGENCY_STOP',
        intentName: 'emergency_stop',
        targetAgent: 'general_ai',
        entities: { rawQuery: raw },
        confidence: 1.0,
        securityTier: 'SAFE_ACTION',
        requiresConfirmation: false,
        requiredPermissions: [],
        explanation: 'Arrêt d\'urgence et interruption immédiate des protocoles.',
      };
    }

    // 1. Phone / Telephony ("appelle maman", "appelle Sarah", "qui m'a appelé", "dernier appel")
    if (
      lower.startsWith('appelle ') ||
      lower.includes('passe un appel') ||
      lower.includes('téléphone à') ||
      lower.includes('telephone a') ||
      lower.includes('qui m\'a appelé') ||
      lower.includes('qui ma appele') ||
      lower.includes('dernier appel manqué') ||
      lower.includes('journal d\'appels') ||
      lower.includes('rappelle le dernier')
    ) {
      let contact = '';
      if (lower.startsWith('appelle ')) {
        contact = raw.substring(8).trim().replace(/[\.\?!]$/, '');
      } else if (lower.includes('téléphone à ') || lower.includes('telephone a ')) {
        contact = raw.split(/téléphone à |telephone a /i)[1]?.trim()?.replace(/[\.\?!]$/, '') || '';
      }

      const isCallAction = !!contact || lower.includes('rappelle');
      return {
        category: 'PHONE_CALL',
        intentName: isCallAction ? 'place_phone_call' : 'check_call_log',
        targetAgent: 'phone',
        entities: {
          contactName: contact,
          rawQuery: raw,
        },
        confidence: 0.96,
        securityTier: isCallAction ? 'SENSITIVE_ACTION' : 'READ',
        requiresConfirmation: isCallAction,
        requiredPermissions: ['android.permission.CALL_PHONE', 'android.permission.READ_CONTACTS'],
        explanation: `Gestion de la téléphonie Android — ${isCallAction ? `Appel vers ${contact || 'contact'}` : 'Consultation des appels'}.`,
      };
    }

    // 2. Communication & Messages ("lis mes messages", "messages whatsapp", "réponds à Sarah")
    if (
      lower.includes('lis mes messages') ||
      lower.includes('lire mes messages') ||
      lower.includes('nouveaux messages') ||
      lower.includes('messages whatsapp') ||
      lower.includes('mes sms') ||
      lower.includes('réponds à') ||
      lower.includes('reponds a') ||
      lower.includes('envoie un message') ||
      lower.includes('envoie un sms') ||
      lower.includes('prépare une réponse')
    ) {
      const isSend = lower.includes('réponds') || lower.includes('reponds') || lower.includes('envoie');
      let targetContact = '';
      if (lower.includes(' à ')) {
        targetContact = raw.split(/ à /i)[1]?.trim()?.split(' ')[0] || '';
      }

      return {
        category: 'COMMUNICATION_MESSAGES',
        intentName: isSend ? 'dispatch_message_reply' : 'read_incoming_messages',
        targetAgent: 'communication',
        entities: {
          contactName: targetContact,
          rawQuery: raw,
        },
        confidence: 0.95,
        securityTier: isSend ? 'SENSITIVE_ACTION' : 'READ',
        requiresConfirmation: isSend,
        requiredPermissions: ['notification_listener'],
        explanation: `Gestion des communications (SMS, WhatsApp, Messageries) — ${isSend ? 'Envoi de message' : 'Lecture sécurisée'}.`,
      };
    }

    // 3. Notifications ("quelles sont mes notifications", "résume mes notifications", "quoi de neuf")
    if (
      lower.includes('notification') ||
      lower.includes('notifications') ||
      lower.includes('alertes') ||
      lower.includes('quoi de neuf') ||
      lower.includes('dernières alertes')
    ) {
      return {
        category: 'NOTIFICATION_READ',
        intentName: 'read_notifications',
        targetAgent: 'notification',
        entities: { rawQuery: raw },
        confidence: 0.92,
        securityTier: 'READ',
        requiresConfirmation: false,
        requiredPermissions: ['notification_listener'],
        explanation: 'Consultation et synthèse vocale des notifications Android.',
      };
    }

    // 4. Android App Control ("ouvre YouTube", "lance Spotify", "ouvre Netflix", "lance l'appareil photo")
    if (
      lower.startsWith('ouvre ') ||
      lower.startsWith('lance ') ||
      lower.includes('ouvre l\'application') ||
      lower.includes('lance l\'application') ||
      lower.includes('ouvre l\'appli') ||
      lower.includes('lance l\'appli')
    ) {
      let appName = '';
      if (lower.startsWith('ouvre ')) {
        appName = raw.substring(6).trim().replace(/[\.\?!]$/, '');
      } else if (lower.startsWith('lance ')) {
        appName = raw.substring(6).trim().replace(/[\.\?!]$/, '');
      }

      return {
        category: 'ANDROID_OPEN_APP',
        intentName: 'launch_application',
        targetAgent: 'android',
        entities: {
          targetApp: appName,
          rawQuery: raw,
        },
        confidence: 0.94,
        securityTier: 'SAFE_ACTION',
        requiresConfirmation: false,
        requiredPermissions: [],
        explanation: `Lancement d'application Android (${appName}).`,
      };
    }

    // 5. Android System Control ("active le wifi", "coupe le bluetooth", "allume la lampe", "volume à 80%")
    if (
      lower.includes('wifi') ||
      lower.includes('bluetooth') ||
      lower.includes('lampe') ||
      lower.includes('torche') ||
      lower.includes('volume') ||
      lower.includes('luminosité') ||
      lower.includes('silencieux') ||
      lower.includes('paramètres') ||
      lower.includes('batterie')
    ) {
      let setting = '';
      if (lower.includes('wifi')) setting = 'wifi';
      else if (lower.includes('bluetooth')) setting = 'bluetooth';
      else if (lower.includes('lampe') || lower.includes('torche')) setting = 'flashlight';
      else if (lower.includes('volume')) setting = 'volume';
      else if (lower.includes('luminosité')) setting = 'brightness';
      else if (lower.includes('silencieux')) setting = 'mute';
      else if (lower.includes('batterie')) setting = 'battery';

      const isRead = lower.includes('batterie') || lower.includes('état');
      return {
        category: 'ANDROID_SYSTEM_CONTROL',
        intentName: isRead ? 'read_system_telemetry' : 'toggle_system_hardware',
        targetAgent: 'android',
        entities: {
          settingName: setting,
          rawQuery: raw,
        },
        confidence: 0.91,
        securityTier: isRead ? 'READ' : 'SAFE_ACTION',
        requiresConfirmation: false,
        requiredPermissions: [],
        explanation: `Contrôle matériel ou télémétrie Android (${setting || 'système'}).`,
      };
    }

    // 6. Weather Agent ("quelle est la météo", "quel temps fait-il", "va-t-il pleuvoir", "température")
    if (
      lower.includes('météo') ||
      lower.includes('meteo') ||
      lower.includes('quel temps') ||
      lower.includes('fait-il beau') ||
      lower.includes('fait-il froid') ||
      lower.includes('fait-il chaud') ||
      lower.includes('pleuvoir') ||
      lower.includes('pluie') ||
      lower.includes('parapluie') ||
      lower.includes('température') ||
      lower.includes('temperature')
    ) {
      let loc = '';
      if (lower.includes(' à ')) {
        loc = raw.split(/ à /i)[1]?.trim()?.split(' ')[0] || '';
      } else if (lower.includes(' en ')) {
        loc = raw.split(/ en /i)[1]?.trim()?.split(' ')[0] || '';
      }

      return {
        category: 'WEATHER_QUERY',
        intentName: 'query_weather',
        targetAgent: 'weather',
        entities: {
          location: loc,
          rawQuery: raw,
        },
        confidence: 0.97,
        securityTier: 'READ',
        requiresConfirmation: false,
        requiredPermissions: [],
        explanation: `Interrogation météorologique certifiée OpenWeather ${loc ? `pour ${loc}` : 'locale'}.`,
      };
    }

    // 7. Web Search & Research ("cherche les dernières informations sur...", "cherche sur le web", "compare")
    if (
      lower.includes('cherche les dernières informations') ||
      lower.includes('cherche sur le web') ||
      lower.includes('recherche sur le web') ||
      lower.includes('dernières nouvelles') ||
      lower.includes('actualités') ||
      lower.includes('compare ces') ||
      lower.includes('trouve les informations officielles') ||
      lower.startsWith('cherche ') ||
      lower.startsWith('recherche ') ||
      lower.includes('qui a gagné') ||
      lower.includes('cours de la bourse')
    ) {
      let topic = raw;
      if (lower.startsWith('cherche les dernières informations sur ')) {
        topic = raw.substring(42).trim();
      } else if (lower.startsWith('cherche sur le web ')) {
        topic = raw.substring(19).trim();
      } else if (lower.startsWith('cherche ')) {
        topic = raw.substring(8).trim();
      } else if (lower.startsWith('recherche ')) {
        topic = raw.substring(10).trim();
      }

      return {
        category: 'WEB_SEARCH',
        intentName: 'live_web_search',
        targetAgent: 'research',
        entities: {
          searchTopic: topic,
          rawQuery: raw,
        },
        confidence: 0.93,
        securityTier: 'READ',
        requiresConfirmation: false,
        requiredPermissions: [],
        explanation: `Recherche web en temps réel et vérification de sources (${topic}).`,
      };
    }

    // 8. Vision / Screen ("regarde mon écran", "qu'y a-t-il à l'écran", "analyse cette image")
    if (
      lower.includes('regarde mon écran') ||
      lower.includes('regarde l\'écran') ||
      lower.includes('que vois-tu') ||
      lower.includes('analyse l\'image') ||
      lower.includes('capture d\'écran') ||
      lower.includes('ocr')
    ) {
      return {
        category: 'SCREEN_VISION',
        intentName: 'analyze_screen_vision',
        targetAgent: 'vision',
        entities: { rawQuery: raw },
        confidence: 0.90,
        securityTier: 'READ',
        requiresConfirmation: false,
        requiredPermissions: ['media_projection'],
        explanation: 'Analyse multimodale de l\'écran et reconnaissance visuelle OCR.',
      };
    }

    // 9. Calendar / Agenda ("mon agenda", "mes rendez-vous", "ajoute un rappel")
    if (
      lower.includes('agenda') ||
      lower.includes('calendrier') ||
      lower.includes('rendez-vous') ||
      lower.includes('rappel') ||
      lower.includes('alarme') ||
      lower.includes('programme du jour')
    ) {
      const isCreate = lower.includes('ajoute') || lower.includes('crée') || lower.includes('mets une alarme');
      return {
        category: 'CALENDAR_REMINDERS',
        intentName: isCreate ? 'create_agenda_item' : 'read_agenda',
        targetAgent: 'calendar',
        entities: { rawQuery: raw },
        confidence: 0.91,
        securityTier: isCreate ? 'SAFE_ACTION' : 'READ',
        requiresConfirmation: false,
        requiredPermissions: ['android.permission.READ_CALENDAR'],
        explanation: `Gestion de l'agenda et des rappels temporels — ${isCreate ? 'Création' : 'Lecture'}.`,
      };
    }

    // 10. General Knowledge & Multi-turn Reasoning (Fallback to General AI)
    return {
      category: 'GENERAL_KNOWLEDGE',
      intentName: 'general_dialogue_reasoning',
      targetAgent: 'general_ai',
      entities: { rawQuery: raw },
      confidence: 0.75,
      securityTier: 'READ',
      requiresConfirmation: false,
      requiredPermissions: [],
      explanation: 'Traitement conversationnel général et raisonnement synthétique.',
    };
  }
}

export const intentUnderstandingEngine = IntentUnderstandingEngine.getInstance();
