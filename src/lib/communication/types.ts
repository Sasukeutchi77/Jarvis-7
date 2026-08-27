/**
 * JARVIS COMMUNICATION AGENT PROTOCOL & CORE TYPES (PHASE 4)
 * 
 * Strict architectural boundaries:
 * 1. ZERO private database access (No sqlite DB hacking, no scraping).
 * 2. ZERO mock/fictitious WhatsApp/Telegram/Messenger APIs.
 * 3. Legitimate NotificationListenerService extraction & NotificationCompat / RemoteInput reply actions.
 * 4. Graceful app launching & user guidance when direct reply action is unavailable.
 * 5. Compulsory human-in-the-loop confirmation before sending.
 * 6. Full Private Mode support (redacting sender & content in audio/vocal output).
 */

export type CommunicationSource =
  | 'whatsapp'
  | 'sms'
  | 'telegram'
  | 'messenger'
  | 'signal'
  | 'generic'
  | 'other';

export type MessageClassification =
  | 'urgent'
  | 'important'
  | 'to_reply'
  | 'info'
  | 'spam';

export interface IncomingMessage {
  id: string;
  source: CommunicationSource;
  packageName: string;
  appName: string;
  sender: string;
  senderPhoneOrId?: string;
  title: string;
  content: string;
  timestamp: number;
  conversationId: string;
  notificationKey?: string;
  notificationId?: number;
  replyAvailable: boolean;
  category: MessageClassification;
  isGroup: boolean;
  groupTitle?: string;
  isRead: boolean;
  isSpoken: boolean;
  isProtected: boolean;
  suggestedReply?: string;
  repliedAt?: number;
  sentReplyText?: string;
  isMemorized?: boolean;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  conversationId: string;
  source: CommunicationSource;
  appName: string;
  packageName: string;
  contactName: string;
  contactIdentifier?: string;
  isGroup: boolean;
  groupTitle?: string;
  lastMessageTimestamp: number;
  lastMessagePreview: string;
  unreadCount: number;
  messages: IncomingMessage[];
  category: MessageClassification;
  requiresReply: boolean;
  replyAvailable: boolean;
  draftReply?: string;
}

export interface CommunicationSourceDefinition {
  source: CommunicationSource;
  displayName: string;
  packages: string[];
  iconName: string;
  brandColor: string;
  badgeClass: string;
  directReplySupported: boolean;
  appLaunchUri: (text?: string, recipient?: string) => string;
  playStoreUrl: string;
}

export interface CommunicationFilterOptions {
  source?: CommunicationSource | 'all';
  category?: MessageClassification | 'all';
  unreadOnly?: boolean;
  requiresReplyOnly?: boolean;
  contactQuery?: string;
}

export interface ReplyDraftRequest {
  messageId?: string;
  conversationId?: string;
  contactName: string;
  source?: CommunicationSource;
  originalMessageContent?: string;
  userInstruction?: string;
  tone?: 'polite' | 'casual' | 'short' | 'direct';
}

export interface ReplyDraftResult {
  suggestedReply: string;
  explanation: string;
  contactName: string;
  source: CommunicationSource;
  targetPackageName?: string;
  replyAvailable: boolean;
  requiresConfirmation: boolean;
}

export interface DispatchReplyParams {
  messageId?: string;
  conversationId?: string;
  packageName: string;
  contactName: string;
  replyText: string;
  notificationKey?: string;
  userConfirmed: boolean;
}

export interface DispatchReplyResult {
  success: boolean;
  method: 'remote_input' | 'app_launch' | 'pending_confirmation' | 'error';
  message: string;
  spokenMessage: string;
  targetApp: string;
  dispatchedAt: number;
}

export interface CommunicationVocalSummary {
  totalUnread: number;
  urgentCount: number;
  toReplyCount: number;
  importantCount: number;
  bySourceBreakdown: Record<string, number>;
  spokenText: string;
  isPrivateModeActive: boolean;
  targetMessages: IncomingMessage[];
}
