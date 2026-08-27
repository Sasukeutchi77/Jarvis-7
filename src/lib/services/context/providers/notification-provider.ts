/**
 * NOTIFICATIONS CONTEXT PROVIDER (PHASE 14)
 * 
 * Provides summary of unread and urgent notifications from Android NotificationListenerService.
 * Gated by READ_NOTIFICATIONS permission.
 */

import { ContextProvider, NotificationContext, NotificationItem, ContextSource } from '../types.js';
import { permissionManager } from '../../security/index.js';
import { PermissionKey } from '../../security/types.js';

export class NotificationContextProvider implements ContextProvider<NotificationContext> {
  public readonly source: ContextSource = 'notifications';
  public readonly name = 'Notifications Système';
  public readonly description = 'Fournit le nombre et l\'aperçu des notifications reçues sur l\'appareil.';
  public readonly requiredPermission: PermissionKey = 'READ_NOTIFICATIONS';
  private enabled: boolean = true;

  private notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      appName: 'WhatsApp',
      packageName: 'com.whatsapp',
      title: 'Alexandre',
      snippet: 'Tu as pu regarder le dossier pour la réunion de 15h ?',
      timestamp: Date.now() - 1000 * 60 * 12,
      isUrgent: false,
    },
    {
      id: 'notif_2',
      appName: 'Gmail',
      packageName: 'com.google.android.gm',
      title: 'Projet JARVIS',
      snippet: 'Validation des jalons Phase 14 & Context Awareness Engine',
      timestamp: Date.now() - 1000 * 60 * 45,
      isUrgent: true,
    },
  ];

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public addNotification(item: Omit<NotificationItem, 'id' | 'timestamp'>): void {
    const newItem: NotificationItem = {
      ...item,
      id: `notif_${Date.now()}`,
      timestamp: Date.now(),
    };
    this.notifications.unshift(newItem);
    if (this.notifications.length > 20) {
      this.notifications.pop();
    }
  }

  public clearNotifications(): void {
    this.notifications = [];
  }

  public async fetchContext(): Promise<NotificationContext> {
    const isGranted = permissionManager.hasPermission('supervisor', 'READ_NOTIFICATIONS');

    if (!isGranted || !this.enabled) {
      return {
        permissionGranted: false,
        unreadCount: 0,
        urgentCount: 0,
        recentNotifications: [],
      };
    }

    const urgentCount = this.notifications.filter((n) => n.isUrgent).length;

    return {
      permissionGranted: true,
      unreadCount: this.notifications.length,
      urgentCount,
      recentNotifications: [...this.notifications],
    };
  }
}
