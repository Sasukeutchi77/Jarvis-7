/**
 * NOTIFICATION PARSER & CLASSIFIER (NotificationListenerService)
 * 
 * Legitimate Android Notification Access:
 * - Listens for android.service.notification.NotificationListenerService events
 * - Identifies target messaging applications by package name
 * - Extracts sender, clean accessible text, conversation title
 * - Classifies importance (urgent, important, to_reply, info)
 * - Identifies if Android RemoteInput (Direct Reply) is available
 * - Strictly respects Private Mode & VIP Protected contacts
 */

import {
  CommunicationSource,
  IncomingMessage,
  MessageClassification,
  CommunicationSourceDefinition,
} from './types.js';

export const SUPPORTED_COMMUNICATION_SOURCES: Record<CommunicationSource, CommunicationSourceDefinition> = {
  whatsapp: {
    source: 'whatsapp',
    displayName: 'WhatsApp',
    packages: ['com.whatsapp', 'com.whatsapp.w4b'],
    iconName: 'MessageCircle',
    brandColor: '#25D366',
    badgeClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    directReplySupported: true,
    appLaunchUri: (text, recipient) =>
      text ? `whatsapp://send?text=${encodeURIComponent(text)}` : 'whatsapp://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.whatsapp',
  },
  sms: {
    source: 'sms',
    displayName: 'SMS & Messages',
    packages: [
      'com.google.android.apps.messaging',
      'com.samsung.android.messaging',
      'com.android.mms',
      'com.simplemobiletools.sms.messenger',
    ],
    iconName: 'MessageSquare',
    brandColor: '#3B82F6',
    badgeClass: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    directReplySupported: true,
    appLaunchUri: (text, recipient) =>
      recipient ? `sms:${recipient}?body=${encodeURIComponent(text || '')}` : 'sms:',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.messaging',
  },
  telegram: {
    source: 'telegram',
    displayName: 'Telegram',
    packages: [
      'org.telegram.messenger',
      'org.telegram.plus',
      'org.telegram.messenger.web',
      'org.thunderdog.challegram',
    ],
    iconName: 'Send',
    brandColor: '#229ED9',
    badgeClass: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    directReplySupported: true,
    appLaunchUri: (text) => (text ? `tg://msg?text=${encodeURIComponent(text)}` : 'tg://'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=org.telegram.messenger',
  },
  messenger: {
    source: 'messenger',
    displayName: 'Messenger',
    packages: ['com.facebook.orca', 'com.facebook.mlite'],
    iconName: 'MessageCircle',
    brandColor: '#0084FF',
    badgeClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    directReplySupported: true,
    appLaunchUri: () => 'fb-messenger://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.facebook.orca',
  },
  signal: {
    source: 'signal',
    displayName: 'Signal',
    packages: ['org.thoughtcrime.securesms'],
    iconName: 'Shield',
    brandColor: '#3A76F0',
    badgeClass: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    directReplySupported: true,
    appLaunchUri: () => 'sgnl://',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=org.thoughtcrime.securesms',
  },
  generic: {
    source: 'generic',
    displayName: 'Messagerie Android',
    packages: [],
    iconName: 'Bell',
    brandColor: '#A855F7',
    badgeClass: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    directReplySupported: true,
    appLaunchUri: () => '',
    playStoreUrl: '',
  },
  other: {
    source: 'other',
    displayName: 'Application',
    packages: [],
    iconName: 'Bell',
    brandColor: '#64748B',
    badgeClass: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    directReplySupported: false,
    appLaunchUri: () => '',
    playStoreUrl: '',
  },
};

export class NotificationParser {
  /**
   * Identify communication source from Android Package Name
   */
  public static identifySource(packageName: string): CommunicationSourceDefinition {
    const norm = (packageName || '').toLowerCase().trim();
    for (const key of Object.keys(SUPPORTED_COMMUNICATION_SOURCES) as CommunicationSource[]) {
      const def = SUPPORTED_COMMUNICATION_SOURCES[key];
      if (def.packages.some((p) => norm.includes(p.toLowerCase()))) {
        return def;
      }
    }
    return SUPPORTED_COMMUNICATION_SOURCES.generic;
  }

  /**
   * Classify message content into urgent, important, to_reply, info, spam
   */
  public static classifyMessage(content: string, sender: string): MessageClassification {
    const text = (content || '').toLowerCase();
    const send = (sender || '').toLowerCase();

    // Urgent checks
    if (
      text.includes('urgent') ||
      text.includes('urgence') ||
      text.includes('immédiat') ||
      text.includes('immediat') ||
      text.includes('sos') ||
      text.includes('appelle-moi vite') ||
      text.includes('rappelle-moi vite') ||
      text.includes('grave')
    ) {
      return 'urgent';
    }

    // Requires response (questions, coordination, calls to action)
    if (
      text.includes('?') ||
      text.includes('peux-tu') ||
      text.includes('est-ce que') ||
      text.includes('dis-moi') ||
      text.includes('tu es où') ||
      text.includes('tu es libre') ||
      text.includes('quand') ||
      text.includes('on se voit') ||
      text.includes('confirme') ||
      text.includes('tu viens') ||
      text.includes('réponds') ||
      text.includes('reponds') ||
      text.includes('tu penses quoi')
    ) {
      return 'to_reply';
    }

    // Important notices
    if (
      text.includes('important') ||
      text.includes('rappel') ||
      text.includes('rdv') ||
      text.includes('rendez-vous') ||
      text.includes('réunion') ||
      text.includes('reunion') ||
      text.includes('contrat') ||
      text.includes('facture') ||
      text.includes('vol') ||
      text.includes('train') ||
      send.includes('banque') ||
      send.includes('docteur') ||
      send.includes('notaire')
    ) {
      return 'important';
    }

    return 'info';
  }

  /**
   * Parse a raw NotificationListenerService event payload into a sanitized IncomingMessage
   */
  public static parseNotificationEvent(raw: {
    id?: string;
    packageName: string;
    appName?: string;
    title?: string;
    text?: string;
    content?: string;
    timestamp?: number;
    conversationTitle?: string;
    notificationKey?: string;
    notificationId?: number;
    hasReplyAction?: boolean;
    isPrivateMode?: boolean;
    protectedContacts?: string[];
  }): IncomingMessage {
    const sourceDef = this.identifySource(raw.packageName);
    const title = (raw.title || '').trim();
    const content = (raw.content || raw.text || '').trim();
    const convTitle = (raw.conversationTitle || '').trim();

    const isGroup = Boolean(convTitle && convTitle !== title);
    const sender = isGroup ? title || 'Membre du groupe' : title || sourceDef.displayName;
    const conversationId = convTitle || sender || 'Conversation';

    const category = this.classifyMessage(content, sender);

    // Private mode & protected contact checks
    const protectedContacts = raw.protectedContacts || ['Banque', 'Docteur', 'Notaire', 'Confidentiel'];
    const isSenderProtected = protectedContacts.some((c) =>
      sender.toLowerCase().includes(c.toLowerCase().trim())
    );
    const isProtected = Boolean(raw.isPrivateMode || isSenderProtected);

    return {
      id: raw.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      source: sourceDef.source,
      packageName: raw.packageName,
      appName: raw.appName || sourceDef.displayName,
      sender,
      title,
      content,
      timestamp: raw.timestamp || Date.now(),
      conversationId,
      notificationKey: raw.notificationKey,
      notificationId: raw.notificationId,
      replyAvailable: raw.hasReplyAction ?? sourceDef.directReplySupported,
      category,
      isGroup,
      groupTitle: isGroup ? convTitle : undefined,
      isRead: false,
      isSpoken: false,
      isProtected,
    };
  }
}
