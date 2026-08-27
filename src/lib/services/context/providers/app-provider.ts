/**
 * ACTIVE FOREGROUND APP CONTEXT PROVIDER (PHASE 14)
 * 
 * Identifies the currently active / foreground application on Android
 * (via AccessibilityService or UsageStats API simulation) with permission checks.
 */

import { ContextProvider, ActiveAppContext, ContextSource } from '../types.js';
import { permissionManager } from '../../security/index.js';
import { PermissionKey } from '../../security/types.js';

export class ActiveAppContextProvider implements ContextProvider<ActiveAppContext> {
  public readonly source: ContextSource = 'app';
  public readonly name = 'Application Active en Premier Plan';
  public readonly description = 'Détecte l\'application Android actuellement affichée à l\'écran pour adapter les actions de JARVIS.';
  public readonly requiredPermission: PermissionKey = 'APPLICATION_LAUNCH';
  private enabled: boolean = true;

  private currentApp: {
    packageName: string;
    appName: string;
    windowTitle?: string;
    category: ActiveAppContext['category'];
    foregroundSince: number;
  } = {
    packageName: 'com.openjarvis.assistant',
    appName: 'JARVIS Assistant',
    windowTitle: 'JARVIS Control Hub',
    category: 'productivity',
    foregroundSince: Date.now(),
  };

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setActiveApp(data: {
    packageName: string;
    appName: string;
    windowTitle?: string;
    category?: ActiveAppContext['category'];
  }): void {
    this.currentApp = {
      packageName: data.packageName,
      appName: data.appName,
      windowTitle: data.windowTitle || data.appName,
      category: data.category || 'other',
      foregroundSince: Date.now(),
    };
  }

  public async fetchContext(): Promise<ActiveAppContext> {
    const isGranted = permissionManager.hasPermission('supervisor', 'APPLICATION_LAUNCH');

    if (!isGranted || !this.enabled) {
      return {
        permissionGranted: false,
      };
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.currentApp.foregroundSince) / 1000));

    return {
      permissionGranted: true,
      packageName: this.currentApp.packageName,
      appName: this.currentApp.appName,
      windowTitle: this.currentApp.windowTitle,
      category: this.currentApp.category,
      foregroundDurationSec: durationSec,
    };
  }
}
