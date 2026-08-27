/**
 * PERMISSION MANAGER (JARVIS ANDROID ARCHITECTURE — PHASE 3)
 * 
 * Pipeline:
 * AndroidAgent -> ActionResolver -> PermissionManager -> Android API
 * 
 * Responsibilities:
 * 1. Evaluate runtime permissions against Android security guidelines.
 * 2. Strictly enforce action tier policies (READ / SAFE_ACTION / SENSITIVE_ACTION).
 * 3. Never bypass or hack Android permission protections.
 * 4. Handle denied permissions gracefully with clear rationale and settings deep-links.
 * 5. Handle Android version differences (e.g., API 33+ notifications, API 29+ scoped storage).
 */

import { AndroidPermissionType, AndroidPermissionStatus, AndroidPermissionDetail, AndroidActionConfirmation } from '../../types';
import { ResolvedAndroidAction, PermissionCheckResult, AndroidActionTier } from './types';
import { ANDROID_PERMISSION_DEFINITIONS, AndroidBridge } from '../android-bridge';
import { jarvisPermissionManager } from './jarvis-permission-manager';

export class PermissionManager {
  private static instance: PermissionManager;
  private currentStatusCache: Map<AndroidPermissionType, AndroidPermissionStatus> = new Map();

  private constructor() {
    this.initializeDefaults();
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  private initializeDefaults() {
    // Initial map
    const types: AndroidPermissionType[] = [
      'microphone',
      'camera',
      'notifications',
      'notification_listener',
      'geolocation',
      'storage',
      'vibration',
      'accessibility',
      'screen_capture',
      'device_admin',
      'phone',
      'contacts',
      'sms',
      'bluetooth',
      'overlay',
      'assistant',
    ];
    for (const t of types) {
      this.currentStatusCache.set(t, 'prompt');
    }
  }

  /**
   * Checks current permission status for a given permission type via real-time probe
   */
  public async getStatus(type: AndroidPermissionType): Promise<AndroidPermissionStatus> {
    try {
      const status = await jarvisPermissionManager.checkPermission(type);
      this.currentStatusCache.set(type, status);
      return status;
    } catch {
      return this.currentStatusCache.get(type) || 'prompt';
    }
  }

  /**
   * Evaluates if a resolved action is authorized to execute.
   * Enforces the 3-Tier Security Architecture:
   * - READ: Requires read/context permissions.
   * - SAFE_ACTION: Requires basic functional permissions.
   * - SENSITIVE_ACTION: Requires explicit user confirmation via Security Modal.
   */
  public async authorizeAction(
    action: ResolvedAndroidAction,
    isConfirmedByUser: boolean = false
  ): Promise<PermissionCheckResult> {
    const missingPermissions: AndroidPermissionType[] = [];
    const deniedPermissions: AndroidPermissionType[] = [];

    // 1. Check all required Android permissions
    for (const perm of action.requiredPermissions) {
      const status = await this.getStatus(perm);
      if (status === 'denied') {
        deniedPermissions.push(perm);
      } else if (status !== 'granted') {
        missingPermissions.push(perm);
      }
    }

    // Handle denied or missing permissions
    if (deniedPermissions.length > 0) {
      const permNames = deniedPermissions.map((p) => ANDROID_PERMISSION_DEFINITIONS[p]?.title || p).join(', ');
      return {
        isAuthorized: false,
        tier: action.tier,
        missingPermissions,
        deniedPermissions,
        requiresUserConfirmation: false,
        reason: `L'autorisation Android "${permNames}" a été refusée sur cet appareil.`,
        remediationAdvice: `Pour permettre à JARVIS d'exécuter cette action, activez l'autorisation dans Paramètres Android > Applications > JARVIS > Autorisations.`,
      };
    }

    if (missingPermissions.length > 0) {
      const permNames = missingPermissions.map((p) => ANDROID_PERMISSION_DEFINITIONS[p]?.title || p).join(', ');
      return {
        isAuthorized: false,
        tier: action.tier,
        missingPermissions,
        deniedPermissions,
        requiresUserConfirmation: false,
        reason: `L'action nécessite l'autorisation Android "${permNames}".`,
        remediationAdvice: `Veuillez accorder l'autorisation lors de l'invite système Android.`,
      };
    }

    // 2. Enforce SENSITIVE_ACTION confirmation tier
    if (action.tier === 'SENSITIVE_ACTION') {
      if (!isConfirmedByUser) {
        return {
          isAuthorized: false,
          tier: 'SENSITIVE_ACTION',
          missingPermissions: [],
          deniedPermissions: [],
          requiresUserConfirmation: true,
          confirmationDetails: action.confirmationDetails || {
            id: `conf_${Date.now()}`,
            actionType: 'system_action',
            title: `Action Sensible : ${action.description}`,
            prompt: `Cette action modifie les paramètres critiques du terminal. Confirmez-vous l'exécution ?`,
            targetDescription: action.description,
            severity: 'high',
            timestamp: Date.now(),
          },
          reason: `Cette opération est classée SENSITIVE_ACTION et exige votre confirmation explicite.`,
        };
      }
    }

    // Authorized
    return {
      isAuthorized: true,
      tier: action.tier,
      missingPermissions: [],
      deniedPermissions: [],
      requiresUserConfirmation: false,
    };
  }

  /**
   * Requests a permission explicitly via standard Android Dialog
   */
  public async requestPermission(type: AndroidPermissionType): Promise<{ granted: boolean; error?: string }> {
    const res = await AndroidBridge.requestPermission(type);
    if (res.granted) {
      this.currentStatusCache.set(type, 'granted');
    } else {
      this.currentStatusCache.set(type, 'denied');
    }
    return res;
  }

  /**
   * Returns metadata for all known permissions
   */
  public getAllPermissionDetails(): AndroidPermissionDetail[] {
    return Object.keys(ANDROID_PERMISSION_DEFINITIONS).map((k) => {
      const type = k as AndroidPermissionType;
      const def = ANDROID_PERMISSION_DEFINITIONS[type];
      return {
        id: type,
        title: def.title,
        description: def.description,
        rationale: def.rationale,
        iconName: def.iconName,
        status: this.currentStatusCache.get(type) || 'granted',
        isCritical: def.isCritical,
      };
    });
  }
}

export const permissionManager = PermissionManager.getInstance();
