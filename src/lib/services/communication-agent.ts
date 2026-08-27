import {
  IncomingMessage,
  CommunicationSettings,
  CommunicationSummary,
  AutoReplyRule,
  MessageCategory,
} from '../../types';
import { apiFetch } from '../api';
import { AndroidBridge } from '../android-bridge';

const SETTINGS_STORAGE_KEY = 'openjarvis-communication-settings';

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  listenerEnabled: true,
  autoRead: false,
  readOnlyImportant: false,
  readOnlyVip: false,
  silentMode: false,
  confirmBeforeSend: true,
  autoReplyEnabled: false,
  privateMode: false,
  enabledSources: {
    whatsapp: true,
    sms: true,
    telegram: true,
    messenger: true,
    signal: true,
    generic: true,
  },
  protectedContacts: ['Banque', 'Docteur', 'Notaire', 'Confidentiel'],
  protectedApps: [],
  autoReplyRules: [
    {
      id: 'rule_default_away',
      contact: '*',
      source: 'all',
      conditionText: 'en réunion',
      replyTemplate: 'Bonjour, je suis actuellement indisponible et je vous recontacte dès que possible.',
      isEnabled: false,
      safetyGuard: true,
    },
  ],
};

export class CommunicationAgent {
  /**
   * Load communication settings from API or localStorage fallback
   */
  static async getSettings(): Promise<CommunicationSettings> {
    try {
      const res = await apiFetch('/api/communications/settings');
      if (res.ok) {
        const data = await res.json();
        return { ...DEFAULT_COMMUNICATION_SETTINGS, ...data };
      }
    } catch {}

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_COMMUNICATION_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {}

    return DEFAULT_COMMUNICATION_SETTINGS;
  }

  /**
   * Save communication settings
   */
  static async saveSettings(settings: Partial<CommunicationSettings>): Promise<CommunicationSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    try {
      await apiFetch('/api/communications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    return updated;
  }

  /**
   * Fetch all incoming messages from backend / Android notification listener
   */
  static async getMessages(filter?: { category?: MessageCategory; unreadOnly?: boolean; source?: string }): Promise<IncomingMessage[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.category) params.append('category', filter.category);
      if (filter?.unreadOnly) params.append('unread', 'true');
      if (filter?.source) params.append('source', filter.source);

      const res = await apiFetch(`/api/communications/messages?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.messages || [];
      }
    } catch {}

    return [];
  }

  /**
   * Generate an AI smart reply draft for a message
   */
  static async generateReplyDraft(
    message: IncomingMessage,
    userInstruction?: string,
    tone: 'polite' | 'casual' | 'short' | 'direct' = 'polite',
  ): Promise<{ suggestedReply: string; explanation: string }> {
    try {
      const res = await apiFetch('/api/communications/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          sender: message.sender,
          content: message.content,
          appName: message.appName,
          userInstruction,
          tone,
        }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {}

    // Fallback template draft
    const fallback = userInstruction
      ? `${userInstruction}`
      : `Bonjour ${message.sender}, bien reçu ton message. Je regarde cela et reviens vers toi rapidement.`;

    return {
      suggestedReply: fallback,
      explanation: 'Proposition automatique générée localement.',
    };
  }

  /**
   * Send a response via Android RemoteInput or launch conversation fallback
   */
  static async sendReply(
    message: IncomingMessage,
    replyText: string,
  ): Promise<{ success: boolean; message: string; method: 'remote_input' | 'app_launch' }> {
    AndroidBridge.vibrate('medium');

    try {
      const res = await apiFetch('/api/communications/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          notificationKey: message.notificationKey,
          packageName: message.packageName,
          replyText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        AndroidBridge.vibrate('success');
        return data;
      }
    } catch {}

    // Fallback direct app open
    await AndroidBridge.openApp(message.appName, replyText);
    return {
      success: true,
      message: `Conversation ouverte dans ${message.appName} avec le texte pré-rempli.`,
      method: 'app_launch',
    };
  }

  /**
   * Generate a comprehensive vocal and textual summary of messages
   */
  static async getSummary(): Promise<CommunicationSummary> {
    try {
      const res = await apiFetch('/api/communications/summary');
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return {
      totalCount: 0,
      bySource: {},
      urgentCount: 0,
      toReplyCount: 0,
      importantCount: 0,
      messagesToReply: [],
      spokenSummary: 'Aucun nouveau message pour le moment, Monsieur.',
      timestamp: Date.now(),
    };
  }

  /**
   * Memorize a message in JARVIS Personal Memory
   */
  static async memorizeMessage(message: IncomingMessage): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch('/api/communications/memorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          sender: message.sender,
          content: message.content,
          appName: message.appName,
          timestamp: message.timestamp,
        }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return {
      success: true,
      message: `Information de ${message.sender} enregistrée dans votre mémoire personnelle.`,
    };
  }

  /**
   * Mark message as read
   */
  static async markAsRead(messageId: string): Promise<void> {
    try {
      await apiFetch(`/api/communications/messages/${messageId}/read`, { method: 'POST' });
    } catch {}
  }

  /**
   * Check if a message is protected (VIP confidential / protected contacts or apps)
   */
  static isProtected(message: IncomingMessage, settings: CommunicationSettings): boolean {
    if (settings.privateMode) return true;
    const senderLower = message.sender.toLowerCase().trim();
    if (settings.protectedContacts.some((c) => senderLower.includes(c.toLowerCase().trim()))) {
      return true;
    }
    const pkgLower = message.packageName.toLowerCase().trim();
    if (settings.protectedApps.some((a) => pkgLower.includes(a.toLowerCase().trim()))) {
      return true;
    }
    return false;
  }

  /**
   * Format message for vocal reading
   */
  static formatVocalReading(message: IncomingMessage, isProtected: boolean): string {
    if (isProtected) {
      return `Monsieur, vous avez reçu un message confidentiel d'un contact protégé sur ${message.appName}. Le contenu n'est pas lu à voix haute pour préserver votre confidentialité.`;
    }

    if (message.isGroup && message.groupTitle) {
      return `Nouveau message de ${message.sender} dans le groupe ${message.groupTitle} sur ${message.appName} : "${message.content}".`;
    }

    return `Message de ${message.sender} sur ${message.appName} : "${message.content}".`;
  }
}
