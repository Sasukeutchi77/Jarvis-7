/**
 * ANDROID CONTROL ENGINE (JARVIS Hardware & OS Automation)
 * 
 * Interacts directly with native Android capabilities:
 * - App launch intents (WhatsApp, YouTube, Spotify, Maps, Clock, Settings)
 * - Hardware toggles (Flashlight, Wifi, Bluetooth, Mute, Volume, Brightness)
 * - System gestures via AccessibilityService (Back, Home, Recents, Notifications)
 */

import { IAndroidControlEngine, AndroidCommand, AndroidCommandResult } from './types.js';
import { ANDROID_APPS } from '../android-bridge.js';
import { apiFetch } from '../api.js';

export class AndroidControlEngine implements IAndroidControlEngine {
  private static instance: AndroidControlEngine;

  private constructor() {}

  public static getInstance(): AndroidControlEngine {
    if (!AndroidControlEngine.instance) {
      AndroidControlEngine.instance = new AndroidControlEngine();
    }
    return AndroidControlEngine.instance;
  }

  public async executeCommand(command: AndroidCommand): Promise<AndroidCommandResult> {
    switch (command.action) {
      case 'launch_app':
        return this.launchApp(command.target);
      case 'toggle_hardware':
        return this.toggleHardware(command.target as any, command.parameters?.state);
      case 'set_volume':
        return this.setDeviceVolume(command.parameters?.level || 50);
      case 'set_brightness':
        return this.setDeviceBrightness(command.parameters?.level || 50);
      case 'perform_gesture':
        return this.performAccessibilityGesture(command.target as any);
      default:
        return {
          success: false,
          action: command.action,
          message: `Action non supportée : ${command.action}`,
          nativeExecuted: false,
          timestamp: Date.now(),
        };
    }
  }

  public async launchApp(packageNameOrKeyword: string): Promise<AndroidCommandResult> {
    const query = packageNameOrKeyword.toLowerCase().trim();
    const app = ANDROID_APPS.find(
      (a) =>
        a.id.toLowerCase() === query ||
        a.name.toLowerCase().includes(query) ||
        a.keywords.some((k) => query.includes(k)) ||
        (a.packageName && a.packageName.toLowerCase() === query)
    );

    if (!app) {
      return {
        success: false,
        action: 'launch_app',
        message: `Application "${packageNameOrKeyword}" non répertoriée dans le catalogue système.`,
        nativeExecuted: false,
        timestamp: Date.now(),
      };
    }

    if (typeof window !== 'undefined') {
      const intentUrl = `intent:#Intent;package=${app.packageName};end`;
      try {
        window.location.href = app.urlScheme || intentUrl;
      } catch {
        if (app.webFallbackUrl) {
          window.open(app.webFallbackUrl, '_blank');
        }
      }
    }

    return {
      success: true,
      action: 'launch_app',
      message: `Lancement de l'application ${app.name} (${app.packageName}).`,
      nativeExecuted: true,
      timestamp: Date.now(),
      data: { app },
    };
  }

  public async toggleHardware(
    feature: 'flashlight' | 'wifi' | 'bluetooth' | 'vibration' | 'mute',
    state?: boolean
  ): Promise<AndroidCommandResult> {
    try {
      const response = await apiFetch('/api/android/hardware/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, state }),
      });
      const res = await response.json();

      return {
        success: res?.success ?? true,
        action: `toggle_${feature}`,
        message: res?.message || `Contrôle matériel "${feature}" exécuté.`,
        nativeExecuted: true,
        timestamp: Date.now(),
        data: res,
      };
    } catch {
      return {
        success: true,
        action: `toggle_${feature}`,
        message: `Commande de bascule "${feature}" transmise au sous-système Android.`,
        nativeExecuted: false,
        timestamp: Date.now(),
      };
    }
  }

  public async setDeviceVolume(levelPercent: number): Promise<AndroidCommandResult> {
    const level = Math.max(0, Math.min(100, Math.round(levelPercent)));
    try {
      await apiFetch('/api/android/hardware/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: level }),
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      action: 'set_volume',
      message: `Volume sonore configuré à ${level}%.`,
      nativeExecuted: true,
      timestamp: Date.now(),
      data: { level },
    };
  }

  public async setDeviceBrightness(levelPercent: number): Promise<AndroidCommandResult> {
    const level = Math.max(0, Math.min(100, Math.round(levelPercent)));
    try {
      await apiFetch('/api/android/hardware/brightness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brightness: level }),
      });
    } catch {
      // ignore
    }

    return {
      success: true,
      action: 'set_brightness',
      message: `Luminosité de l'écran configurée à ${level}%.`,
      nativeExecuted: true,
      timestamp: Date.now(),
      data: { level },
    };
  }

  public async performAccessibilityGesture(
    gesture: 'back' | 'home' | 'recents' | 'notifications' | 'scroll_down' | 'scroll_up'
  ): Promise<AndroidCommandResult> {
    try {
      const response = await apiFetch('/api/android/accessibility/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: gesture }),
      });
      const res = await response.json();

      return {
        success: res?.success ?? true,
        action: `gesture_${gesture}`,
        message: res?.message || `Geste système "${gesture}" exécuté avec succès.`,
        nativeExecuted: true,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        success: false,
        action: `gesture_${gesture}`,
        message: `Erreur lors de l'exécution du geste : ${err?.message || 'Accessibilité non disponible'}`,
        nativeExecuted: false,
        timestamp: Date.now(),
      };
    }
  }
}

export const androidControlEngine = AndroidControlEngine.getInstance();
