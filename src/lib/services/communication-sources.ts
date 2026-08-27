import { CommunicationSourceType, IncomingMessage, MessageCategory } from '../../types';

export interface SourceAppConfig {
  type: CommunicationSourceType;
  name: string;
  packages: string[];
  iconName: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  replySupported: boolean;
  deepLinkScheme: (text?: string, recipient?: string) => string;
  webFallback: (recipient?: string) => string;
}

export const COMMUNICATION_SOURCES: Record<CommunicationSourceType, SourceAppConfig> = {
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp',
    packages: ['com.whatsapp', 'com.whatsapp.w4b'],
    iconName: 'MessageCircle',
    color: '#25D366',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    badgeText: 'WhatsApp',
    replySupported: true,
    deepLinkScheme: (text, recipient) =>
      text ? `whatsapp://send?text=${encodeURIComponent(text)}` : 'whatsapp://',
    webFallback: (recipient) =>
      recipient ? `https://wa.me/?text=` : 'https://web.whatsapp.com',
  },
  sms: {
    type: 'sms',
    name: 'SMS & Messages',
    packages: [
      'com.google.android.apps.messaging',
      'com.samsung.android.messaging',
      'com.android.mms',
      'com.simplemobiletools.sms.messenger',
    ],
    iconName: 'MessageSquare',
    color: '#3B82F6',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    badgeText: 'SMS',
    replySupported: true,
    deepLinkScheme: (text, recipient) =>
      recipient ? `sms:${recipient}?body=${encodeURIComponent(text || '')}` : 'sms:',
    webFallback: () => 'https://messages.google.com/web',
  },
  telegram: {
    type: 'telegram',
    name: 'Telegram',
    packages: [
      'org.telegram.messenger',
      'org.telegram.plus',
      'org.telegram.messenger.web',
      'org.thunderdog.challegram',
    ],
    iconName: 'Send',
    color: '#229ED9',
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    badgeText: 'Telegram',
    replySupported: true,
    deepLinkScheme: (text) => (text ? `tg://msg?text=${encodeURIComponent(text)}` : 'tg://'),
    webFallback: () => 'https://web.telegram.org',
  },
  messenger: {
    type: 'messenger',
    name: 'Messenger',
    packages: ['com.facebook.orca', 'com.facebook.mlite'],
    iconName: 'MessageCircle',
    color: '#0084FF',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    badgeText: 'Messenger',
    replySupported: true,
    deepLinkScheme: () => 'fb-messenger://',
    webFallback: () => 'https://www.messenger.com',
  },
  signal: {
    type: 'signal',
    name: 'Signal',
    packages: ['org.thoughtcrime.securesms'],
    iconName: 'Shield',
    color: '#3A76F0',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    badgeText: 'Signal',
    replySupported: true,
    deepLinkScheme: () => 'sgnl://',
    webFallback: () => 'https://signal.org',
  },
  generic: {
    type: 'generic',
    name: 'Messagerie',
    packages: [],
    iconName: 'Bell',
    color: '#A855F7',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    badgeText: 'Notification',
    replySupported: true,
    deepLinkScheme: () => '',
    webFallback: () => '',
  },
  other: {
    type: 'other',
    name: 'Application',
    packages: [],
    iconName: 'Bell',
    color: '#64748B',
    badgeBg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    badgeText: 'Autre',
    replySupported: false,
    deepLinkScheme: () => '',
    webFallback: () => '',
  },
};

/**
 * Identify communication source config from Android package name
 */
export function identifySourceByPackage(packageName: string): SourceAppConfig {
  const normalized = packageName.toLowerCase().trim();
  for (const key of Object.keys(COMMUNICATION_SOURCES) as CommunicationSourceType[]) {
    const config = COMMUNICATION_SOURCES[key];
    if (config.packages.some((pkg) => pkg.toLowerCase() === normalized)) {
      return config;
    }
  }
  return COMMUNICATION_SOURCES.generic;
}

/**
 * Normalize and clean up incoming notification payload into IncomingMessage
 */
export function normalizeIncomingMessage(raw: {
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
}): IncomingMessage {
  const sourceConfig = identifySourceByPackage(raw.packageName);
  const title = (raw.title || '').trim();
  const content = (raw.content || raw.text || '').trim();
  const convTitle = (raw.conversationTitle || '').trim();

  const isGroup = Boolean(convTitle && convTitle !== title);
  const sender = isGroup ? title || 'Membre du groupe' : title || sourceConfig.name;

  // Basic categorization heuristics
  const lower = content.toLowerCase();
  let category: MessageCategory = 'info';

  if (
    lower.includes('urgent') ||
    lower.includes('urgence') ||
    lower.includes('appelle-moi') ||
    lower.includes('immédiat') ||
    lower.includes('sos')
  ) {
    category = 'urgent';
  } else if (
    lower.includes('?') ||
    lower.includes('peux-tu') ||
    lower.includes('dis-moi') ||
    lower.includes('quand') ||
    lower.includes('tu es où') ||
    lower.includes('tu viens') ||
    lower.includes('réponds')
  ) {
    category = 'to_reply';
  } else if (
    lower.includes('important') ||
    lower.includes('rappel') ||
    lower.includes('réunion') ||
    lower.includes('attention') ||
    lower.includes('rdv')
  ) {
    category = 'important';
  }

  return {
    id: raw.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source: sourceConfig.type,
    packageName: raw.packageName,
    appName: raw.appName || sourceConfig.name,
    sender,
    title,
    content,
    timestamp: raw.timestamp || Date.now(),
    conversationId: convTitle || sender,
    notificationKey: raw.notificationKey,
    notificationId: raw.notificationId,
    replyAvailable: raw.hasReplyAction ?? sourceConfig.replySupported,
    category,
    isGroup,
    groupTitle: isGroup ? convTitle : undefined,
    isRead: false,
    isSpoken: false,
    isProtected: false,
  };
}
