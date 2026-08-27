/**
 * PERMISSION MANAGER (JARVIS Unified Permission & Capability Bridge)
 * 
 * Bridges:
 * - Android OS capability auditing (17 capabilities)
 * - Agent permission levels & ACLs
 * - Resolution intents to Android Settings
 */

import { IPermissionManager, PermissionAuditSummary } from './types.js';
import { AndroidPermissionAuditor } from '../services/security/android-permission-auditor.js';

export class PermissionManager implements IPermissionManager {
  private static instance: PermissionManager;

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  public async auditAllCapabilities(): Promise<PermissionAuditSummary> {
    const report = AndroidPermissionAuditor.getAuditReport();
    const authorizedCount = report.filter((r) => r.isGranted).length;
    const missingCount = report.length - authorizedCount;

    let overallStatus: 'JARVIS_READY' | 'JARVIS_PARTIALLY_READY' | 'SETUP_REQUIRED' = 'SETUP_REQUIRED';
    if (missingCount === 0) {
      overallStatus = 'JARVIS_READY';
    } else if (authorizedCount >= 3) {
      overallStatus = 'JARVIS_PARTIALLY_READY';
    }

    return {
      totalCapabilities: report.length,
      authorizedCount,
      missingCount,
      overallStatus,
      capabilities: report.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.isGranted ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
        resolutionSteps: c.settingsResolutionPath,
      })),
    };
  }

  public isCapabilityGranted(id: string): boolean {
    const status = AndroidPermissionAuditor.checkCapability(id as any);
    return status.status === 'AUTHORIZED';
  }

  public async requestCapability(
    id: string
  ): Promise<{ success: boolean; resolutionUrl?: string; message: string }> {
    const status = AndroidPermissionAuditor.checkCapability(id as any);
    if (status.status === 'AUTHORIZED') {
      return { success: true, message: `La permission "${status.name}" est déjà accordée.` };
    }

    if (status.officialIntentAction && typeof window !== 'undefined') {
      const intentUrl = `intent:#Intent;action=${status.officialIntentAction};end`;
      try {
        window.location.href = intentUrl;
      } catch {
        // ignore
      }
      return {
        success: false,
        resolutionUrl: intentUrl,
        message: `Redirection vers les paramètres Android : ${status.officialResolutionSteps}`,
      };
    }

    return {
      success: false,
      message: `Action requise dans les paramètres système : ${status.officialResolutionSteps}`,
    };
  }

  public async openAndroidSettings(intentAction?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const action = intentAction || 'android.settings.SETTINGS';
    window.location.href = `intent:#Intent;action=${action};end`;
  }
}

export const permissionManager = PermissionManager.getInstance();
