/**
 * NOTIFICATION ENGINE (JARVIS Communication & Alert Processing)
 * 
 * Intercepts, categorizes, prioritizes, and vocally summarizes Android notifications.
 * Connects directly to NotificationListenerService.
 */

import { INotificationEngine, ProcessedNotification } from './types.js';
import { apiFetch } from '../api.js';

export class NotificationEngine implements INotificationEngine {
  private static instance: NotificationEngine;
  private listeners: Set<(notification: ProcessedNotification) => void> = new Set();
  private cachedNotifications: ProcessedNotification[] = [];

  private constructor() {}

  public static getInstance(): NotificationEngine {
    if (!NotificationEngine.instance) {
      NotificationEngine.instance = new NotificationEngine();
    }
    return NotificationEngine.instance;
  }

  public async getActiveNotifications(): Promise<ProcessedNotification[]> {
    try {
      const response = await apiFetch('/api/android/notifications');
      const res = await response.json();
      if (res && Array.isArray(res.notifications)) {
        this.cachedNotifications = res.notifications.map((n: any) => ({
          id: n.id || `notif_${Date.now()}_${Math.random()}`,
          packageName: n.packageName || 'com.android.system',
          appName: n.appName || 'Système',
          title: n.title || '',
          text: n.text || '',
          category: n.category || 'system',
          timestamp: n.timestamp || Date.now(),
          isUrgent: Boolean(n.isUrgent),
          spokenSummary: n.spokenSummary,
        }));
      }
    } catch {
      // Return cached
    }
    return this.cachedNotifications;
  }

  public async getUrgentAlerts(): Promise<ProcessedNotification[]> {
    const all = await this.getActiveNotifications();
    return all.filter((n) => n.isUrgent || n.category === 'call' || n.category === 'alarm');
  }

  public async summarizeNotifications(): Promise<string> {
    const list = await this.getActiveNotifications();
    if (list.length === 0) {
      return "Toutes vos notifications sont à jour, Monsieur. Aucune alerte active.";
    }

    const urgent = list.filter((n) => n.isUrgent);
    if (urgent.length > 0) {
      return `Vous avez ${list.length} notifications, dont ${urgent.length} prioritaire(s). La plus récente provient de ${urgent[0].appName} : "${urgent[0].title}".`;
    }

    return `Vous avez ${list.length} notification(s) en attente. Dernière alerte reçue de ${list[0].appName}.`;
  }

  public async dismissNotification(id: string): Promise<boolean> {
    try {
      await apiFetch(`/api/android/notifications/${id}/dismiss`, { method: 'POST' });
      this.cachedNotifications = this.cachedNotifications.filter((n) => n.id !== id);
      return true;
    } catch {
      return false;
    }
  }

  public onNotificationReceived(callback: (notification: ProcessedNotification) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const notificationEngine = NotificationEngine.getInstance();
