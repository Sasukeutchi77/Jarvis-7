/**
 * CONVERSATION MANAGER (PHASE 4)
 * 
 * Aggregates individual IncomingMessages into unified threads (Conversations).
 * Manages thread state, unread counters, reply status, and triage.
 */

import {
  IncomingMessage,
  Conversation,
  CommunicationFilterOptions,
  CommunicationSource,
} from './types.js';
import { SUPPORTED_COMMUNICATION_SOURCES } from './notification-parser.js';

export class ConversationManager {
  private static instance: ConversationManager;
  private messages: IncomingMessage[] = [];

  private constructor() {
    this.seedInitialMessages();
  }

  public static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  /**
   * Seed realistic notifications adhering to legitimate notification structure
   */
  private seedInitialMessages() {
    this.messages = [
      {
        id: 'msg_init_wa_1',
        source: 'whatsapp',
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        sender: 'Sarah Connor',
        title: 'Sarah Connor',
        content: 'Salut ! Peux-tu me confirmer si la réunion de 15h30 est maintenue au labo ?',
        timestamp: Date.now() - 180000,
        conversationId: 'Sarah Connor',
        notificationKey: 'wa_notif_1001',
        notificationId: 1001,
        replyAvailable: true,
        category: 'to_reply',
        isGroup: false,
        isRead: false,
        isSpoken: false,
        isProtected: false,
        suggestedReply: 'Oui tout à fait Sarah, la réunion est maintenue à 15h30 au labo.',
      },
      {
        id: 'msg_init_sms_2',
        source: 'sms',
        packageName: 'com.google.android.apps.messaging',
        appName: 'SMS & Messages',
        sender: 'Alexandre Martin',
        title: 'Alexandre Martin',
        content: 'URGENT : Le serveur de pré-production ne répond plus suite au dernier commit. Peux-tu jeter un œil ?',
        timestamp: Date.now() - 420000,
        conversationId: 'Alexandre Martin',
        notificationKey: 'sms_notif_1002',
        notificationId: 1002,
        replyAvailable: true,
        category: 'urgent',
        isGroup: false,
        isRead: false,
        isSpoken: false,
        isProtected: false,
        suggestedReply: 'Je regarde immédiatement les métriques et les logs du serveur.',
      },
      {
        id: 'msg_init_tg_3',
        source: 'telegram',
        packageName: 'org.telegram.messenger',
        appName: 'Telegram',
        sender: 'David Stark',
        title: 'David Stark',
        content: 'Est-ce que tu as eu le temps de tester la nouvelle version de l\'agent Android ?',
        timestamp: Date.now() - 900000,
        conversationId: 'David Stark',
        notificationKey: 'tg_notif_1003',
        notificationId: 1003,
        replyAvailable: true,
        category: 'to_reply',
        isGroup: false,
        isRead: false,
        isSpoken: false,
        isProtected: false,
        suggestedReply: 'Oui, les tests unitaires et la résolution d\'actions sont à 100% passés !',
      },
      {
        id: 'msg_init_messenger_4',
        source: 'messenger',
        packageName: 'com.facebook.orca',
        appName: 'Messenger',
        sender: 'Émilie',
        title: 'Émilie',
        content: 'On se retrouve ce soir pour le dîner d\'équipe à 20h ?',
        timestamp: Date.now() - 1500000,
        conversationId: 'Émilie',
        notificationKey: 'fb_notif_1004',
        notificationId: 1004,
        replyAvailable: true,
        category: 'to_reply',
        isGroup: false,
        isRead: false,
        isSpoken: false,
        isProtected: false,
        suggestedReply: 'Parfait pour 20h, j\'y serai !',
      },
      {
        id: 'msg_init_signal_5',
        source: 'signal',
        packageName: 'org.thoughtcrime.securesms',
        appName: 'Signal',
        sender: 'Cabinet Notarial',
        title: 'Cabinet Notarial',
        content: 'Votre dossier confidentiel a été validé par l\'étude.',
        timestamp: Date.now() - 3600000,
        conversationId: 'Cabinet Notarial',
        notificationKey: 'sgnl_notif_1005',
        notificationId: 1005,
        replyAvailable: true,
        category: 'important',
        isGroup: false,
        isRead: true,
        isSpoken: false,
        isProtected: true,
      },
    ];
  }

  /**
   * Add a new incoming notification message
   */
  public addMessage(message: IncomingMessage): void {
    this.messages.unshift(message);
    if (this.messages.length > 300) {
      this.messages.pop();
    }
  }

  /**
   * Get all raw messages
   */
  public getAllMessages(options?: CommunicationFilterOptions): IncomingMessage[] {
    let list = [...this.messages];

    if (options?.source && options.source !== 'all') {
      list = list.filter((m) => m.source === options.source);
    }
    if (options?.category && options.category !== 'all') {
      list = list.filter((m) => m.category === options.category);
    }
    if (options?.unreadOnly) {
      list = list.filter((m) => !m.isRead);
    }
    if (options?.requiresReplyOnly) {
      list = list.filter((m) => m.category === 'to_reply' || m.category === 'urgent');
    }
    if (options?.contactQuery) {
      const q = options.contactQuery.toLowerCase().trim();
      list = list.filter((m) =>
        m.sender.toLowerCase().includes(q) ||
        m.conversationId.toLowerCase().includes(q)
      );
    }

    return list;
  }

  /**
   * Aggregate messages into Conversations
   */
  public getConversations(options?: CommunicationFilterOptions): Conversation[] {
    const messages = this.getAllMessages(options);
    const groups: Map<string, IncomingMessage[]> = new Map();

    for (const msg of messages) {
      const key = `${msg.source}:${msg.conversationId}`;
      const existing = groups.get(key) || [];
      existing.push(msg);
      groups.set(key, existing);
    }

    const conversations: Conversation[] = [];

    for (const [key, msgList] of groups.entries()) {
      // Sort messages chronologically descending
      msgList.sort((a, b) => b.timestamp - a.timestamp);
      const latest = msgList[0];
      const unreadCount = msgList.filter((m) => !m.isRead).length;
      const requiresReply = msgList.some(
        (m) => !m.isRead && (m.category === 'to_reply' || m.category === 'urgent')
      );

      // Thread classification
      let category = latest.category;
      if (msgList.some((m) => !m.isRead && m.category === 'urgent')) {
        category = 'urgent';
      } else if (msgList.some((m) => !m.isRead && m.category === 'to_reply')) {
        category = 'to_reply';
      }

      conversations.push({
        id: `conv_${key}`,
        conversationId: latest.conversationId,
        source: latest.source,
        appName: latest.appName,
        packageName: latest.packageName,
        contactName: latest.sender,
        isGroup: latest.isGroup,
        groupTitle: latest.groupTitle,
        lastMessageTimestamp: latest.timestamp,
        lastMessagePreview: latest.content,
        unreadCount,
        messages: msgList,
        category,
        requiresReply,
        replyAvailable: latest.replyAvailable,
        draftReply: latest.suggestedReply,
      });
    }

    // Sort conversations by latest message timestamp
    conversations.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
    return conversations;
  }

  /**
   * Find a specific conversation or message by contact query
   */
  public findByContact(contactQuery: string, source?: CommunicationSource): {
    conversation?: Conversation;
    message?: IncomingMessage;
  } {
    const q = contactQuery.toLowerCase().trim();
    const convs = this.getConversations({ source });

    const matchedConv = convs.find((c) =>
      c.contactName.toLowerCase().includes(q) ||
      (c.groupTitle && c.groupTitle.toLowerCase().includes(q))
    );

    if (matchedConv && matchedConv.messages.length > 0) {
      return { conversation: matchedConv, message: matchedConv.messages[0] };
    }

    const matchedMsg = this.messages.find((m) =>
      m.sender.toLowerCase().includes(q) &&
      (!source || m.source === source)
    );

    return { message: matchedMsg };
  }

  /**
   * Mark message or entire conversation as read
   */
  public markAsRead(id: string): void {
    const msg = this.messages.find((m) => m.id === id);
    if (msg) {
      msg.isRead = true;
      return;
    }

    // Check if conversation ID
    for (const m of this.messages) {
      if (m.conversationId === id || `conv_${m.source}:${m.conversationId}` === id) {
        m.isRead = true;
      }
    }
  }

  /**
   * Record a dispatched reply
   */
  public recordReply(messageId: string, replyText: string): void {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.isRead = true;
      msg.repliedAt = Date.now();
      msg.sentReplyText = replyText;
    }
  }
}
